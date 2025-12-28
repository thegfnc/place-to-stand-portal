import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projects, githubRepoLinks, suggestions, threads, messages } from '@/lib/db/schema'
import { createSuggestionsFromMessage } from '@/lib/ai/suggestion-service'

/**
 * GET /api/projects/[projectId]/ai-suggestions
 *
 * Returns suggestions for the project with message context.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  // Get project to find the client
  const [project] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (!project.clientId) {
    return NextResponse.json({
      emails: [],
      meta: {
        totalEmails: 0,
        pendingSuggestions: 0,
        unanalyzedEmails: 0,
        hasGitHubRepos: false,
        message: 'Project has no client. Link threads to a client first.',
      },
    })
  }

  // Get pending only based on query param
  const pendingOnly = request.nextUrl.searchParams.get('pendingOnly') === 'true'

  // Get suggestions for this project's client
  const suggestionQuery = db
    .select({
      suggestion: suggestions,
      message: messages,
      thread: threads,
    })
    .from(suggestions)
    .leftJoin(messages, eq(messages.id, suggestions.messageId))
    .leftJoin(threads, eq(threads.id, suggestions.threadId))
    .where(
      and(
        eq(threads.clientId, project.clientId),
        isNull(suggestions.deletedAt),
        pendingOnly ? eq(suggestions.status, 'PENDING') : undefined
      )
    )
    .orderBy(desc(suggestions.createdAt))
    .limit(100)

  const [suggestionRows, gitHubRepos, unanalyzedMessages] = await Promise.all([
    suggestionQuery,
    db
      .select({ id: githubRepoLinks.id })
      .from(githubRepoLinks)
      .where(
        and(
          eq(githubRepoLinks.projectId, projectId),
          isNull(githubRepoLinks.deletedAt)
        )
      )
      .limit(1),
    // Count unanalyzed messages for this client's threads (must belong to current user)
    db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(threads, eq(threads.id, messages.threadId))
      .where(
        and(
          eq(threads.clientId, project.clientId),
          eq(messages.userId, user.id),
          isNull(messages.deletedAt),
          isNull(messages.analyzedAt)
        )
      )
      .limit(100),
  ])

  const pendingCount = suggestionRows.filter(s => s.suggestion.status === 'PENDING').length

  // Group suggestions by message/email (format expected by the hook)
  const emailMap = new Map<string, {
    id: string
    subject: string | null
    snippet: string | null
    fromEmail: string
    fromName: string | null
    receivedAt: string | null
    suggestions: Array<{
      id: string
      suggestedTitle: string
      suggestedDescription: string | null
      suggestedDueDate: string | null
      suggestedPriority: string | null
      confidence: string
      reasoning: string | null
      status: string
    }>
  }>()

  for (const row of suggestionRows) {
    if (!row.message) continue

    const messageId = row.message.id
    const content = row.suggestion.suggestedContent as {
      title?: string
      description?: string
      dueDate?: string
      priority?: string
    } | null

    const suggestion = {
      id: row.suggestion.id,
      suggestedTitle: content?.title || 'Untitled',
      suggestedDescription: content?.description || null,
      suggestedDueDate: content?.dueDate || null,
      suggestedPriority: content?.priority || null,
      confidence: row.suggestion.confidence,
      reasoning: row.suggestion.reasoning,
      status: row.suggestion.status,
    }

    if (emailMap.has(messageId)) {
      emailMap.get(messageId)!.suggestions.push(suggestion)
    } else {
      emailMap.set(messageId, {
        id: messageId,
        subject: row.message.subject,
        snippet: row.message.snippet,
        fromEmail: row.message.fromEmail,
        fromName: row.message.fromName,
        receivedAt: row.message.sentAt,
        suggestions: [suggestion],
      })
    }
  }

  const emails = Array.from(emailMap.values())

  return NextResponse.json({
    emails,
    meta: {
      totalEmails: emails.length,
      pendingSuggestions: pendingCount,
      unanalyzedEmails: unanalyzedMessages.length,
      hasGitHubRepos: gitHubRepos.length > 0,
    },
  })
}

/**
 * POST /api/projects/[projectId]/ai-suggestions
 *
 * Triggers AI analysis of unanalyzed messages linked to the project's client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  // Get project to find the client
  const [project] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (!project.clientId) {
    return NextResponse.json(
      { error: 'Project has no client' },
      { status: 400 }
    )
  }

  // Get unanalyzed message IDs from threads linked to this client (must belong to current user)
  const unanalyzedIds = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(
      and(
        eq(threads.clientId, project.clientId),
        eq(messages.userId, user.id),
        isNull(messages.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .limit(20)

  if (unanalyzedIds.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      created: 0,
      message: 'No unanalyzed messages found',
    })
  }

  // Analyze messages (limit to prevent timeout)
  const limit = Math.min(unanalyzedIds.length, 10)
  let analyzed = 0
  let created = 0
  let errors = 0

  for (let i = 0; i < limit; i++) {
    try {
      const result = await createSuggestionsFromMessage(unanalyzedIds[i].id, user.id)
      analyzed++
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze message ${unanalyzedIds[i].id}:`, error)
      errors++
    }
  }

  return NextResponse.json({
    analyzed,
    created,
    errors,
    remaining: unanalyzedIds.length - limit,
  })
}

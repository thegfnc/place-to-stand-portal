import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projects, githubRepoLinks } from '@/lib/db/schema'
import {
  getClientEmailsWithSuggestions,
  getClientPendingSuggestionCount,
  getUnanalyzedClientEmailIds,
} from '@/lib/queries/ai-suggestions'
import { createSuggestionsFromEmail } from '@/lib/ai/suggestion-service'

/**
 * GET /api/projects/[projectId]/ai-suggestions
 *
 * Returns emails linked to the project's client along with their task suggestions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  await requireRole('ADMIN')
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
        message: 'Project has no client. Link emails to a client first.',
      },
    })
  }

  // Get pending only based on query param
  const pendingOnly = request.nextUrl.searchParams.get('pendingOnly') === 'true'

  // Fetch data in parallel
  const [emails, pendingCount, unanalyzedIds, gitHubRepos] = await Promise.all([
    getClientEmailsWithSuggestions(project.clientId, {
      limit: 100,
      pendingOnly,
    }),
    getClientPendingSuggestionCount(project.clientId),
    getUnanalyzedClientEmailIds(project.clientId),
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
  ])

  return NextResponse.json({
    emails,
    meta: {
      totalEmails: emails.length,
      pendingSuggestions: pendingCount,
      unanalyzedEmails: unanalyzedIds.length,
      hasGitHubRepos: gitHubRepos.length > 0,
    },
  })
}

/**
 * POST /api/projects/[projectId]/ai-suggestions
 *
 * Triggers AI analysis of unanalyzed emails linked to the project's client.
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

  // Get unanalyzed email IDs
  const unanalyzedIds = await getUnanalyzedClientEmailIds(project.clientId)

  if (unanalyzedIds.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      created: 0,
      message: 'No unanalyzed emails found',
    })
  }

  // Analyze emails (limit to prevent timeout)
  const limit = Math.min(unanalyzedIds.length, 10)
  let analyzed = 0
  let created = 0
  let errors = 0

  for (let i = 0; i < limit; i++) {
    try {
      const result = await createSuggestionsFromEmail(unanalyzedIds[i], user.id)
      analyzed++
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze email ${unanalyzedIds[i]}:`, error)
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

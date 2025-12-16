import 'server-only'

import { eq, and, isNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { taskSuggestions, emailMetadata, emailLinks, clients, projects, tasks } from '@/lib/db/schema'
import { analyzeEmailForTasks, filterByConfidence } from './email-analysis'
import { getMessage, normalizeEmail } from '@/lib/gmail/client'
import type { NewTaskSuggestion } from '@/lib/types/suggestions'

const MODEL_VERSION = 'gemini-2.5-flash-lite-v1'
const MIN_CONFIDENCE = 0.5

interface CreateSuggestionsResult {
  created: number
  skipped: boolean
  reason?: string
}

/**
 * Analyze a single email and create task suggestions
 */
export async function createSuggestionsFromEmail(
  emailId: string,
  userId: string
): Promise<CreateSuggestionsResult> {
  // Get email metadata
  const [email] = await db
    .select()
    .from(emailMetadata)
    .where(
      and(
        eq(emailMetadata.id, emailId),
        eq(emailMetadata.userId, userId),
        isNull(emailMetadata.deletedAt)
      )
    )
    .limit(1)

  if (!email) {
    throw new Error('Email not found')
  }

  // Check if already analyzed
  const existing = await db
    .select({ id: taskSuggestions.id })
    .from(taskSuggestions)
    .where(
      and(
        eq(taskSuggestions.emailMetadataId, emailId),
        isNull(taskSuggestions.deletedAt)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return { created: 0, skipped: true, reason: 'already_analyzed' }
  }

  // Get email body from Gmail
  let bodyText: string | undefined
  try {
    const gmailMessage = await getMessage(userId, email.gmailMessageId)
    const normalized = normalizeEmail(gmailMessage)
    bodyText = normalized.bodyText
  } catch (err) {
    console.error('Failed to fetch Gmail message:', err)
    return { created: 0, skipped: true, reason: 'gmail_fetch_failed' }
  }

  if (!bodyText) {
    return { created: 0, skipped: true, reason: 'no_body' }
  }

  // Get linked client/project context
  const [link] = await db
    .select({
      clientId: emailLinks.clientId,
      clientName: clients.name,
      projectId: emailLinks.projectId,
      projectName: projects.name,
    })
    .from(emailLinks)
    .leftJoin(clients, eq(clients.id, emailLinks.clientId))
    .leftJoin(projects, eq(projects.id, emailLinks.projectId))
    .where(
      and(
        eq(emailLinks.emailMetadataId, emailId),
        isNull(emailLinks.deletedAt)
      )
    )
    .limit(1)

  // Get recent tasks if we have a project
  let recentTasks: string[] = []
  if (link?.projectId) {
    const recent = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, link.projectId),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(10)
    recentTasks = recent.map(t => t.title)
  }

  // Analyze with AI
  const { result, usage } = await analyzeEmailForTasks({
    subject: email.subject || '',
    body: bodyText,
    fromEmail: email.fromEmail,
    fromName: email.fromName || undefined,
    receivedAt: email.receivedAt,
    clientName: link?.clientName || undefined,
    projectName: link?.projectName || undefined,
    recentTasks,
  })

  // If no action required, skip
  if (result.noActionRequired || result.tasks.length === 0) {
    return { created: 0, skipped: false, reason: 'no_action_required' }
  }

  // Filter by confidence
  const validTasks = filterByConfidence(result.tasks, MIN_CONFIDENCE)

  if (validTasks.length === 0) {
    return { created: 0, skipped: false, reason: 'low_confidence' }
  }

  // Create suggestions
  const suggestions: NewTaskSuggestion[] = validTasks.map(task => ({
    emailMetadataId: emailId,
    projectId: link?.projectId || null,
    suggestedTitle: task.title,
    suggestedDescription: task.description || null,
    suggestedDueDate: task.dueDate || null,
    suggestedPriority: task.priority || null,
    suggestedAssignees: [],
    confidence: String(task.confidence),
    reasoning: task.reasoning,
    status: 'PENDING' as const,
    aiModelVersion: MODEL_VERSION,
    promptTokens: Math.round(usage.promptTokens / validTasks.length),
    completionTokens: Math.round(usage.completionTokens / validTasks.length),
  }))

  await db.insert(taskSuggestions).values(suggestions)

  return { created: suggestions.length, skipped: false }
}

/**
 * Process multiple unanalyzed emails for a user
 */
export async function processUnanalyzedEmails(
  userId: string,
  limit: number = 50
): Promise<{ processed: number; created: number; errors: number }> {
  // Find emails without suggestions
  const unanalyzed = await db
    .select({ id: emailMetadata.id })
    .from(emailMetadata)
    .leftJoin(
      taskSuggestions,
      and(
        eq(taskSuggestions.emailMetadataId, emailMetadata.id),
        isNull(taskSuggestions.deletedAt)
      )
    )
    .where(
      and(
        eq(emailMetadata.userId, userId),
        isNull(emailMetadata.deletedAt),
        isNull(taskSuggestions.id)
      )
    )
    .limit(limit)

  let created = 0
  let errors = 0

  for (const { id } of unanalyzed) {
    try {
      const result = await createSuggestionsFromEmail(id, userId)
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze email ${id}:`, error)
      errors++
    }
  }

  return { processed: unanalyzed.length, created, errors }
}

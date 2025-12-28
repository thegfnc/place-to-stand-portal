import 'server-only'

import { eq, and, isNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { suggestions, messages, threads, projects, tasks } from '@/lib/db/schema'
import { analyzeEmailForTasks, filterByConfidence } from './email-analysis'
import { getMessage, normalizeEmail } from '@/lib/gmail/client'
import { markMessageAsAnalyzed } from '@/lib/queries/messages'
import type { NewSuggestion, TaskSuggestedContent } from '@/lib/types/suggestions'

const MODEL_VERSION = 'gemini-2.5-flash-lite-v1'
const MIN_CONFIDENCE = 0.5

interface CreateSuggestionsResult {
  created: number
  skipped: boolean
  reason?: string
}

/**
 * Analyze a single message and create task suggestions
 */
export async function createSuggestionsFromMessage(
  messageId: string,
  userId: string
): Promise<CreateSuggestionsResult> {
  // Get message with thread info
  const [message] = await db
    .select({
      message: messages,
      thread: threads,
    })
    .from(messages)
    .leftJoin(threads, eq(threads.id, messages.threadId))
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.userId, userId),
        isNull(messages.deletedAt)
      )
    )
    .limit(1)

  if (!message) {
    throw new Error('Message not found')
  }

  // Check if already analyzed
  if (message.message.analyzedAt) {
    return { created: 0, skipped: true, reason: 'already_analyzed' }
  }

  // Check if suggestions already exist
  const existing = await db
    .select({ id: suggestions.id })
    .from(suggestions)
    .where(
      and(
        eq(suggestions.messageId, messageId),
        isNull(suggestions.deletedAt)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return { created: 0, skipped: true, reason: 'already_analyzed' }
  }

  // Get message body - use stored body or fetch from Gmail
  let bodyText = message.message.bodyText

  if (!bodyText && message.message.externalMessageId) {
    try {
      const gmailMessage = await getMessage(userId, message.message.externalMessageId)
      const normalized = normalizeEmail(gmailMessage)
      bodyText = normalized.bodyText ?? null
    } catch (err) {
      console.error('Failed to fetch Gmail message:', err)
      return { created: 0, skipped: true, reason: 'gmail_fetch_failed' }
    }
  }

  if (!bodyText) {
    return { created: 0, skipped: true, reason: 'no_body' }
  }

  // Get project context from thread
  const projectId = message.thread?.projectId ?? null
  let projectName: string | undefined
  let recentTasks: string[] = []

  if (projectId) {
    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    projectName = project?.name

    const recent = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(10)
    recentTasks = recent.map(t => t.title)
  }

  // Get client name from thread
  let clientName: string | undefined
  if (message.thread?.clientId) {
    const { clients } = await import('@/lib/db/schema')
    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, message.thread.clientId))
      .limit(1)
    clientName = client?.name
  }

  // Analyze with AI
  const { result, usage } = await analyzeEmailForTasks({
    subject: message.message.subject || '',
    body: bodyText,
    fromEmail: message.message.fromEmail,
    fromName: message.message.fromName || undefined,
    receivedAt: message.message.sentAt,
    clientName,
    projectName,
    recentTasks,
  })

  // If no action required, skip
  if (result.noActionRequired || result.tasks.length === 0) {
    // Mark as analyzed even if no tasks found
    await markMessageAsAnalyzed(messageId, MODEL_VERSION)
    return { created: 0, skipped: false, reason: 'no_action_required' }
  }

  // Filter by confidence
  const validTasks = filterByConfidence(result.tasks, MIN_CONFIDENCE)

  if (validTasks.length === 0) {
    await markMessageAsAnalyzed(messageId, MODEL_VERSION)
    return { created: 0, skipped: false, reason: 'low_confidence' }
  }

  // Create suggestions with unified schema
  const suggestionValues: NewSuggestion[] = validTasks.map(task => ({
    messageId,
    threadId: message.message.threadId,
    type: 'TASK' as const,
    status: 'PENDING' as const,
    projectId,
    confidence: String(task.confidence),
    reasoning: task.reasoning,
    aiModelVersion: MODEL_VERSION,
    promptTokens: Math.round(usage.promptTokens / validTasks.length),
    completionTokens: Math.round(usage.completionTokens / validTasks.length),
    suggestedContent: {
      title: task.title,
      description: task.description || undefined,
      dueDate: task.dueDate || undefined,
      priority: task.priority || undefined,
    } satisfies TaskSuggestedContent,
  }))

  await db.insert(suggestions).values(suggestionValues)

  // Mark message as analyzed
  await markMessageAsAnalyzed(messageId, MODEL_VERSION)

  return { created: suggestionValues.length, skipped: false }
}

/**
 * Process multiple unanalyzed messages for a user
 */
export async function processUnanalyzedMessages(
  userId: string,
  limit: number = 50
): Promise<{ processed: number; created: number; errors: number }> {
  // Find messages without analysis
  const unanalyzed = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        isNull(messages.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(limit)

  let created = 0
  let errors = 0

  for (const { id } of unanalyzed) {
    try {
      const result = await createSuggestionsFromMessage(id, userId)
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze message ${id}:`, error)
      errors++
    }
  }

  return { processed: unanalyzed.length, created, errors }
}

/**
 * Analyze messages for a specific client
 */
export async function analyzeMessagesForClient(
  clientId: string,
  userId: string,
  limit: number = 20
): Promise<{ processed: number; created: number; errors: number }> {
  // Find unanalyzed messages for threads linked to this client
  const unanalyzed = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(
      and(
        eq(threads.clientId, clientId),
        eq(messages.userId, userId),
        isNull(messages.deletedAt),
        isNull(threads.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(limit)

  let created = 0
  let errors = 0

  for (const { id } of unanalyzed) {
    try {
      const result = await createSuggestionsFromMessage(id, userId)
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze message ${id}:`, error)
      errors++
    }
  }

  return { processed: unanalyzed.length, created, errors }
}

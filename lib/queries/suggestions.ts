import 'server-only'

import { and, desc, eq, isNull, inArray, sql, or } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  suggestions,
  suggestionFeedback,
  messages,
  threads,
  projects,
  githubRepoLinks,
  tasks,
  users,
} from '@/lib/db/schema'
import { isAdmin } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import type {
  Suggestion,
  NewSuggestion,
  SuggestionWithContext,
  SuggestionSummary,
  SuggestionType,
  SuggestionStatus,
  SuggestionFeedback as SuggestionFeedbackType,
  TaskSuggestedContent,
  PRSuggestedContent,
} from '@/lib/types/suggestions'

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getSuggestionById(id: string): Promise<Suggestion | null> {
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, id), isNull(suggestions.deletedAt)))
    .limit(1)

  return suggestion ?? null
}

export async function getSuggestionWithContext(id: string): Promise<SuggestionWithContext | null> {
  const suggestion = await getSuggestionById(id)
  if (!suggestion) return null

  // Fetch related entities in parallel
  const [messageRow, threadRow, projectRow, repoLinkRow, taskRow] = await Promise.all([
    suggestion.messageId
      ? db
          .select({
            id: messages.id,
            subject: messages.subject,
            fromEmail: messages.fromEmail,
            fromName: messages.fromName,
            sentAt: messages.sentAt,
          })
          .from(messages)
          .where(eq(messages.id, suggestion.messageId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.threadId
      ? db
          .select({
            id: threads.id,
            subject: threads.subject,
            source: threads.source,
          })
          .from(threads)
          .where(eq(threads.id, suggestion.threadId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.projectId
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(eq(projects.id, suggestion.projectId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.githubRepoLinkId
      ? db
          .select({
            id: githubRepoLinks.id,
            repoFullName: githubRepoLinks.repoFullName,
            defaultBranch: githubRepoLinks.defaultBranch,
          })
          .from(githubRepoLinks)
          .where(eq(githubRepoLinks.id, suggestion.githubRepoLinkId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.createdTaskId
      ? db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(eq(tasks.id, suggestion.createdTaskId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
  ])

  return {
    ...suggestion,
    message: messageRow,
    thread: threadRow,
    project: projectRow,
    githubRepoLink: repoLinkRow,
    createdTask: taskRow,
  }
}

export type CreateSuggestionInput = {
  messageId?: string | null
  threadId?: string | null
  type: SuggestionType
  status?: SuggestionStatus
  projectId?: string | null
  githubRepoLinkId?: string | null
  confidence: number
  reasoning?: string | null
  aiModelVersion?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  suggestedContent: TaskSuggestedContent | PRSuggestedContent
}

export async function createSuggestion(input: CreateSuggestionInput): Promise<Suggestion> {
  const [suggestion] = await db
    .insert(suggestions)
    .values({
      messageId: input.messageId ?? null,
      threadId: input.threadId ?? null,
      type: input.type,
      status: input.status ?? 'PENDING',
      projectId: input.projectId ?? null,
      githubRepoLinkId: input.githubRepoLinkId ?? null,
      confidence: input.confidence.toString(),
      reasoning: input.reasoning ?? null,
      aiModelVersion: input.aiModelVersion ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      suggestedContent: input.suggestedContent,
    })
    .returning()

  return suggestion
}

export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  metadata?: {
    reviewedBy?: string
    reviewNotes?: string
    createdTaskId?: string
    createdPrNumber?: number
    createdPrUrl?: string
    errorMessage?: string
  }
): Promise<Suggestion> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  }

  if (metadata?.reviewedBy) {
    updateData.reviewedBy = metadata.reviewedBy
    updateData.reviewedAt = new Date().toISOString()
  }
  if (metadata?.reviewNotes !== undefined) {
    updateData.reviewNotes = metadata.reviewNotes
  }
  if (metadata?.createdTaskId) {
    updateData.createdTaskId = metadata.createdTaskId
  }
  if (metadata?.createdPrNumber) {
    updateData.createdPrNumber = metadata.createdPrNumber
  }
  if (metadata?.createdPrUrl) {
    updateData.createdPrUrl = metadata.createdPrUrl
  }
  if (metadata?.errorMessage !== undefined) {
    updateData.errorMessage = metadata.errorMessage
  }

  const [updated] = await db
    .update(suggestions)
    .set(updateData)
    .where(eq(suggestions.id, id))
    .returning()

  if (!updated) throw new NotFoundError('Suggestion not found')
  return updated
}

export async function updateSuggestionContent(
  id: string,
  content: TaskSuggestedContent | PRSuggestedContent
): Promise<Suggestion> {
  const [updated] = await db
    .update(suggestions)
    .set({
      suggestedContent: content,
      status: 'MODIFIED',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(suggestions.id, id))
    .returning()

  if (!updated) throw new NotFoundError('Suggestion not found')
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion Listing
// ─────────────────────────────────────────────────────────────────────────────

export type ListSuggestionsOptions = {
  type?: SuggestionType
  status?: SuggestionStatus | SuggestionStatus[]
  projectId?: string
  threadId?: string
  messageId?: string
  limit?: number
  offset?: number
}

export async function listPendingSuggestions(
  options: ListSuggestionsOptions = {}
): Promise<SuggestionSummary[]> {
  const { type, projectId, threadId, messageId, limit = 50, offset = 0 } = options

  const conditions = [
    isNull(suggestions.deletedAt),
    or(eq(suggestions.status, 'PENDING'), eq(suggestions.status, 'DRAFT')),
  ]

  if (type) {
    conditions.push(eq(suggestions.type, type))
  }
  if (projectId) {
    conditions.push(eq(suggestions.projectId, projectId))
  }
  if (threadId) {
    conditions.push(eq(suggestions.threadId, threadId))
  }
  if (messageId) {
    conditions.push(eq(suggestions.messageId, messageId))
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.confidence), desc(suggestions.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  // Get message info for suggestions with messageId
  const messageIds = [...new Set(rows.map(s => s.messageId).filter(Boolean))] as string[]
  const messageRows = messageIds.length > 0
    ? await db
        .select({ id: messages.id, subject: messages.subject, fromEmail: messages.fromEmail })
        .from(messages)
        .where(inArray(messages.id, messageIds))
    : []
  const messageMap = new Map(messageRows.map(m => [m.id, m]))

  // Get project info
  const projectIds = [...new Set(rows.map(s => s.projectId).filter(Boolean))] as string[]
  const projectRows = projectIds.length > 0
    ? await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds))
    : []
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  return rows.map(suggestion => {
    const content = suggestion.suggestedContent as Record<string, unknown>
    return {
      id: suggestion.id,
      type: suggestion.type as SuggestionType,
      status: suggestion.status as SuggestionStatus,
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt,
      title: typeof content.title === 'string' ? content.title : undefined,
      body: typeof content.body === 'string' && !content.title ? content.body : undefined,
      message: suggestion.messageId ? messageMap.get(suggestion.messageId) ?? null : null,
      project: suggestion.projectId ? projectMap.get(suggestion.projectId) ?? null : null,
    }
  })
}

export async function listSuggestionsForThread(
  threadId: string,
  options: { includeResolved?: boolean } = {}
): Promise<SuggestionSummary[]> {
  const { includeResolved = false } = options

  const conditions = [
    eq(suggestions.threadId, threadId),
    isNull(suggestions.deletedAt),
  ]

  if (!includeResolved) {
    conditions.push(
      or(
        eq(suggestions.status, 'PENDING'),
        eq(suggestions.status, 'DRAFT'),
        eq(suggestions.status, 'MODIFIED')
      )!
    )
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.confidence))

  return rows.map(suggestion => {
    const content = suggestion.suggestedContent as Record<string, unknown>
    return {
      id: suggestion.id,
      type: suggestion.type as SuggestionType,
      status: suggestion.status as SuggestionStatus,
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt,
      title: typeof content.title === 'string' ? content.title : undefined,
      body: typeof content.body === 'string' && !content.title ? content.body : undefined,
      message: null,
      project: null,
    }
  })
}

export async function listSuggestionsForMessage(
  messageId: string,
  options: { includeResolved?: boolean } = {}
): Promise<SuggestionSummary[]> {
  const { includeResolved = false } = options

  const conditions = [
    eq(suggestions.messageId, messageId),
    isNull(suggestions.deletedAt),
  ]

  if (!includeResolved) {
    conditions.push(
      or(
        eq(suggestions.status, 'PENDING'),
        eq(suggestions.status, 'DRAFT'),
        eq(suggestions.status, 'MODIFIED')
      )!
    )
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.confidence))

  return rows.map(suggestion => {
    const content = suggestion.suggestedContent as Record<string, unknown>
    return {
      id: suggestion.id,
      type: suggestion.type as SuggestionType,
      status: suggestion.status as SuggestionStatus,
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt,
      title: typeof content.title === 'string' ? content.title : undefined,
      body: typeof content.body === 'string' && !content.title ? content.body : undefined,
      message: null,
      project: null,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion Counts
// ─────────────────────────────────────────────────────────────────────────────

export async function getPendingSuggestionCounts(): Promise<{
  total: number
  byType: Record<SuggestionType, number>
}> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      task: sql<number>`count(*) FILTER (WHERE ${suggestions.type} = 'TASK')::int`,
      pr: sql<number>`count(*) FILTER (WHERE ${suggestions.type} = 'PR')::int`,
      reply: sql<number>`count(*) FILTER (WHERE ${suggestions.type} = 'REPLY')::int`,
    })
    .from(suggestions)
    .where(
      and(
        isNull(suggestions.deletedAt),
        or(eq(suggestions.status, 'PENDING'), eq(suggestions.status, 'DRAFT'))
      )
    )

  return {
    total: counts?.total ?? 0,
    byType: {
      TASK: counts?.task ?? 0,
      PR: counts?.pr ?? 0,
      REPLY: counts?.reply ?? 0,
    },
  }
}

export async function getProjectPendingSuggestionCount(projectId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suggestions)
    .where(
      and(
        eq(suggestions.projectId, projectId),
        isNull(suggestions.deletedAt),
        or(eq(suggestions.status, 'PENDING'), eq(suggestions.status, 'DRAFT'))
      )
    )

  return result?.count ?? 0
}

export async function getClientPendingSuggestionCount(clientId: string): Promise<number> {
  // Get suggestions for threads linked to this client
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suggestions)
    .innerJoin(threads, eq(threads.id, suggestions.threadId))
    .where(
      and(
        eq(threads.clientId, clientId),
        isNull(suggestions.deletedAt),
        isNull(threads.deletedAt),
        or(eq(suggestions.status, 'PENDING'), eq(suggestions.status, 'DRAFT'))
      )
    )

  return result?.count ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion Feedback
// ─────────────────────────────────────────────────────────────────────────────

export type CreateFeedbackInput = {
  suggestionId: string
  feedbackType: string
  originalValue?: string | null
  correctedValue?: string | null
  createdBy: string
}

export async function createSuggestionFeedback(input: CreateFeedbackInput): Promise<SuggestionFeedbackType> {
  const [feedback] = await db
    .insert(suggestionFeedback)
    .values({
      suggestionId: input.suggestionId,
      feedbackType: input.feedbackType,
      originalValue: input.originalValue ?? null,
      correctedValue: input.correctedValue ?? null,
      createdBy: input.createdBy,
    })
    .returning()

  return feedback
}

export async function listFeedbackForSuggestion(suggestionId: string): Promise<SuggestionFeedbackType[]> {
  const rows = await db
    .select()
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.suggestionId, suggestionId))
    .orderBy(desc(suggestionFeedback.createdAt))

  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions for Project (used by project board AI panel)
// ─────────────────────────────────────────────────────────────────────────────

export interface SuggestionForProject extends SuggestionSummary {
  message: {
    subject: string | null
    fromEmail: string
    fromName: string | null
    sentAt: string
  } | null
  suggestedContent: TaskSuggestedContent | PRSuggestedContent
  reasoning: string | null
}

export async function getSuggestionsForProject(
  projectId: string,
  options: { pendingOnly?: boolean; type?: SuggestionType; limit?: number } = {}
): Promise<SuggestionForProject[]> {
  const { pendingOnly = true, type, limit = 50 } = options

  const conditions = [
    eq(suggestions.projectId, projectId),
    isNull(suggestions.deletedAt),
  ]

  if (pendingOnly) {
    conditions.push(
      or(
        eq(suggestions.status, 'PENDING'),
        eq(suggestions.status, 'DRAFT'),
        eq(suggestions.status, 'MODIFIED')
      )!
    )
  }

  if (type) {
    conditions.push(eq(suggestions.type, type))
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.confidence), desc(suggestions.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  // Get message info
  const messageIds = [...new Set(rows.map(s => s.messageId).filter(Boolean))] as string[]
  const messageRows = messageIds.length > 0
    ? await db
        .select({
          id: messages.id,
          subject: messages.subject,
          fromEmail: messages.fromEmail,
          fromName: messages.fromName,
          sentAt: messages.sentAt,
        })
        .from(messages)
        .where(inArray(messages.id, messageIds))
    : []
  const messageMap = new Map(messageRows.map(m => [m.id, m]))

  return rows.map(suggestion => {
    const content = suggestion.suggestedContent as TaskSuggestedContent | PRSuggestedContent
    const rawContent = suggestion.suggestedContent as Record<string, unknown>
    return {
      id: suggestion.id,
      type: suggestion.type as SuggestionType,
      status: suggestion.status as SuggestionStatus,
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt,
      title: typeof rawContent.title === 'string' ? rawContent.title : undefined,
      body: typeof rawContent.body === 'string' && !rawContent.title ? rawContent.body : undefined,
      message: suggestion.messageId ? messageMap.get(suggestion.messageId) ?? null : null,
      project: null,
      suggestedContent: content,
      reasoning: suggestion.reasoning,
    }
  })
}

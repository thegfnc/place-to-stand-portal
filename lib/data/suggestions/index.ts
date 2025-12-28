import 'server-only'

import { eq, and, isNull, desc, sql, or, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  suggestions,
  suggestionFeedback,
  messages,
  threads,
  projects,
  tasks,
  githubRepoLinks,
} from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import { createPullRequest, branchExists, createBranch } from '@/lib/github/client'
import type {
  SuggestionWithContext,
  SuggestionType,
  SuggestionStatus,
  TaskSuggestedContent,
  PRSuggestedContent,
} from '@/lib/types/suggestions'

// ─────────────────────────────────────────────────────────────────────────────
// Get Suggestions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get pending suggestions for review
 */
export async function getPendingSuggestions(
  options: { limit?: number; projectId?: string; type?: SuggestionType } = {}
): Promise<SuggestionWithContext[]> {
  const { limit = 50, projectId, type } = options

  const conditions = [
    or(eq(suggestions.status, 'PENDING'), eq(suggestions.status, 'DRAFT')),
    isNull(suggestions.deletedAt),
  ]

  if (projectId) {
    conditions.push(eq(suggestions.projectId, projectId))
  }

  if (type) {
    conditions.push(eq(suggestions.type, type))
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  // Fetch related entities
  const messageIds = [...new Set(rows.map(s => s.messageId).filter(Boolean))] as string[]
  const threadIds = [...new Set(rows.map(s => s.threadId).filter(Boolean))] as string[]
  const projectIds = [...new Set(rows.map(s => s.projectId).filter(Boolean))] as string[]
  const repoLinkIds = [...new Set(rows.map(s => s.githubRepoLinkId).filter(Boolean))] as string[]

  const [messageRows, threadRows, projectRows, repoLinkRows] = await Promise.all([
    messageIds.length > 0
      ? db
          .select({
            id: messages.id,
            subject: messages.subject,
            fromEmail: messages.fromEmail,
            fromName: messages.fromName,
            sentAt: messages.sentAt,
          })
          .from(messages)
          .where(inArray(messages.id, messageIds))
      : [],
    threadIds.length > 0
      ? db
          .select({ id: threads.id, subject: threads.subject, source: threads.source })
          .from(threads)
          .where(inArray(threads.id, threadIds))
      : [],
    projectIds.length > 0
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [],
    repoLinkIds.length > 0
      ? db
          .select({
            id: githubRepoLinks.id,
            repoFullName: githubRepoLinks.repoFullName,
            defaultBranch: githubRepoLinks.defaultBranch,
          })
          .from(githubRepoLinks)
          .where(inArray(githubRepoLinks.id, repoLinkIds))
      : [],
  ])

  const messageMap = new Map(messageRows.map(m => [m.id, m]))
  const threadMap = new Map(threadRows.map(t => [t.id, t]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))
  const repoLinkMap = new Map(repoLinkRows.map(r => [r.id, r]))

  return rows.map(suggestion => ({
    ...suggestion,
    message: suggestion.messageId ? messageMap.get(suggestion.messageId) ?? null : null,
    thread: suggestion.threadId ? threadMap.get(suggestion.threadId) ?? null : null,
    project: suggestion.projectId ? projectMap.get(suggestion.projectId) ?? null : null,
    githubRepoLink: suggestion.githubRepoLinkId ? repoLinkMap.get(suggestion.githubRepoLinkId) ?? null : null,
    createdTask: null,
  }))
}

/**
 * Get a single suggestion by ID with full context
 */
export async function getSuggestionById(
  suggestionId: string
): Promise<SuggestionWithContext | null> {
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, suggestionId), isNull(suggestions.deletedAt)))
    .limit(1)

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
          .select({ id: threads.id, subject: threads.subject, source: threads.source })
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
            repoOwner: githubRepoLinks.repoOwner,
            repoName: githubRepoLinks.repoName,
            oauthConnectionId: githubRepoLinks.oauthConnectionId,
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
    githubRepoLink: repoLinkRow
      ? {
          id: repoLinkRow.id,
          repoFullName: repoLinkRow.repoFullName,
          defaultBranch: repoLinkRow.defaultBranch,
        }
      : null,
    createdTask: taskRow,
    // Add extra repo info for PR suggestions
    ...(repoLinkRow && {
      _repoOwner: repoLinkRow.repoOwner,
      _repoName: repoLinkRow.repoName,
      _oauthConnectionId: repoLinkRow.oauthConnectionId,
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polymorphic Approve/Reject
// ─────────────────────────────────────────────────────────────────────────────

export interface ApproveTaskModifications {
  title?: string
  description?: string
  projectId?: string
  dueDate?: string
  priority?: string
  status?: 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
}

export interface ApprovePRModifications {
  title?: string
  body?: string
  branch?: string
  baseBranch?: string
  createNewBranch?: boolean
}

/**
 * Approve a suggestion - polymorphic handler
 */
export async function approveSuggestion(
  suggestionId: string,
  userId: string,
  modifications?: ApproveTaskModifications | ApprovePRModifications
): Promise<{ taskId?: string; prNumber?: number; prUrl?: string }> {
  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (!['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)) {
    throw new Error('Suggestion already processed')
  }

  if (suggestion.type === 'TASK') {
    return approveTaskSuggestion(suggestion, userId, modifications as ApproveTaskModifications)
  }

  if (suggestion.type === 'PR') {
    return approvePRSuggestion(suggestion, userId, modifications as ApprovePRModifications)
  }

  throw new Error(`Unknown suggestion type: ${suggestion.type}`)
}

/**
 * Approve a TASK suggestion and create a task
 */
async function approveTaskSuggestion(
  suggestion: SuggestionWithContext,
  userId: string,
  modifications?: ApproveTaskModifications
): Promise<{ taskId: string }> {
  const content = suggestion.suggestedContent as TaskSuggestedContent

  const finalTitle = modifications?.title ?? content.title
  const finalDescription = modifications?.description ?? content.description
  const finalProjectId = modifications?.projectId ?? suggestion.projectId
  const finalDueDate = modifications?.dueDate ?? content.dueDate
  const finalStatus = modifications?.status ?? 'BACKLOG'

  if (!finalProjectId) {
    throw new Error('Project is required')
  }

  // Record feedback for modifications
  const feedbackRecords: Array<{
    suggestionId: string
    feedbackType: string
    originalValue: string | null
    correctedValue: string | null
    createdBy: string
  }> = []

  if (modifications?.title && modifications.title !== content.title) {
    feedbackRecords.push({
      suggestionId: suggestion.id,
      feedbackType: 'title_changed',
      originalValue: content.title,
      correctedValue: modifications.title,
      createdBy: userId,
    })
  }

  if (modifications?.description && modifications.description !== content.description) {
    feedbackRecords.push({
      suggestionId: suggestion.id,
      feedbackType: 'description_changed',
      originalValue: content.description || null,
      correctedValue: modifications.description,
      createdBy: userId,
    })
  }

  if (modifications?.projectId && modifications.projectId !== suggestion.projectId) {
    feedbackRecords.push({
      suggestionId: suggestion.id,
      feedbackType: 'project_changed',
      originalValue: suggestion.projectId || null,
      correctedValue: modifications.projectId,
      createdBy: userId,
    })
  }

  // Create task and update suggestion in transaction
  const result = await db.transaction(async tx => {
    const [newTask] = await tx
      .insert(tasks)
      .values({
        projectId: finalProjectId,
        title: finalTitle,
        description: finalDescription,
        dueOn: finalDueDate,
        status: finalStatus,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning()

    await tx
      .update(suggestions)
      .set({
        status: feedbackRecords.length > 0 ? 'MODIFIED' : 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        createdTaskId: newTask.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suggestions.id, suggestion.id))

    if (feedbackRecords.length > 0) {
      await tx.insert(suggestionFeedback).values(feedbackRecords)
    }

    return { task: newTask }
  })

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'TASK_CREATED_FROM_SUGGESTION',
    summary: `Created task "${finalTitle}" from AI suggestion`,
    targetType: 'TASK',
    targetId: result.task.id,
    targetProjectId: finalProjectId,
    metadata: {
      suggestionId: suggestion.id,
      messageId: suggestion.messageId,
      wasModified: feedbackRecords.length > 0,
    },
  })

  return { taskId: result.task.id }
}

/**
 * Approve a PR suggestion and create actual GitHub PR
 */
async function approvePRSuggestion(
  suggestion: SuggestionWithContext & {
    _repoOwner?: string
    _repoName?: string
    _oauthConnectionId?: string
  },
  userId: string,
  modifications?: ApprovePRModifications
): Promise<{ prNumber: number; prUrl: string }> {
  const content = suggestion.suggestedContent as PRSuggestedContent

  const finalTitle = modifications?.title ?? content.title
  const finalBody = modifications?.body ?? content.body
  const finalBranch = modifications?.branch ?? content.branch
  const finalBaseBranch = modifications?.baseBranch ?? content.baseBranch ?? 'main'

  if (!finalBranch) {
    throw new Error('Branch name is required')
  }

  if (!suggestion._repoOwner || !suggestion._repoName || !suggestion._oauthConnectionId) {
    throw new Error('Missing repository information')
  }

  const repoFullName = suggestion.githubRepoLink?.repoFullName ?? 'unknown'

  try {
    // Check if branch exists
    const exists = await branchExists(
      userId,
      suggestion._repoOwner,
      suggestion._repoName,
      finalBranch,
      suggestion._oauthConnectionId
    )

    // Create branch if needed
    if (!exists) {
      if (modifications?.createNewBranch) {
        await createBranch(
          userId,
          suggestion._repoOwner,
          suggestion._repoName,
          {
            newBranch: finalBranch,
            baseBranch: finalBaseBranch,
          },
          suggestion._oauthConnectionId
        )
      } else {
        throw new Error(
          `Branch "${finalBranch}" does not exist. Enable "Create new branch" to create it automatically.`
        )
      }
    }

    // Create PR on GitHub
    const pr = await createPullRequest(
      userId,
      suggestion._repoOwner,
      suggestion._repoName,
      {
        title: finalTitle,
        body: finalBody,
        head: finalBranch,
        base: finalBaseBranch,
      },
      suggestion._oauthConnectionId
    )

    // Update suggestion status
    await db
      .update(suggestions)
      .set({
        status: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        createdPrNumber: pr.number,
        createdPrUrl: pr.html_url,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suggestions.id, suggestion.id))

    await logActivity({
      actorId: userId,
      actorRole: 'ADMIN',
      verb: 'PR_CREATED_FROM_SUGGESTION',
      summary: `Created PR #${pr.number} on ${repoFullName}`,
      targetType: 'PROJECT',
      targetId: suggestion.id,
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        repoFullName,
      },
    })

    return { prNumber: pr.number, prUrl: pr.html_url }
  } catch (error) {
    await db
      .update(suggestions)
      .set({
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suggestions.id, suggestion.id))

    throw error
  }
}

/**
 * Reject a suggestion
 */
export async function rejectSuggestion(
  suggestionId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (!['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)) {
    throw new Error('Suggestion already processed')
  }

  await db.transaction(async tx => {
    await tx
      .update(suggestions)
      .set({
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suggestions.id, suggestionId))

    if (reason) {
      const content = suggestion.suggestedContent as TaskSuggestedContent | PRSuggestedContent
      await tx.insert(suggestionFeedback).values({
        suggestionId,
        feedbackType: 'rejected',
        originalValue: 'title' in content ? content.title : null,
        correctedValue: reason,
        createdBy: userId,
      })
    }
  })

  const content = suggestion.suggestedContent as TaskSuggestedContent | PRSuggestedContent
  const title = 'title' in content ? content.title : 'Untitled'

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: suggestion.type === 'PR' ? 'PR_SUGGESTION_REJECTED' : 'TASK_SUGGESTION_REJECTED',
    summary: `Rejected ${suggestion.type.toLowerCase()} suggestion "${title}"`,
    targetType: suggestion.type === 'PR' ? 'PROJECT' : 'TASK',
    targetId: suggestionId,
    metadata: { reason },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Counts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get suggestion counts by status
 */
export async function getSuggestionCounts(): Promise<{
  pending: number
  approved: number
  rejected: number
  byType: { TASK: number; PR: number; REPLY: number }
}> {
  const results = await db
    .select({
      status: suggestions.status,
      type: suggestions.type,
      count: sql<number>`count(*)::int`,
    })
    .from(suggestions)
    .where(isNull(suggestions.deletedAt))
    .groupBy(suggestions.status, suggestions.type)

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    byType: { TASK: 0, PR: 0, REPLY: 0 },
  }

  for (const r of results) {
    if (r.status === 'PENDING' || r.status === 'DRAFT') {
      counts.pending += r.count
      counts.byType[r.type as keyof typeof counts.byType] += r.count
    }
    if (r.status === 'APPROVED' || r.status === 'MODIFIED') counts.approved += r.count
    if (r.status === 'REJECTED') counts.rejected += r.count
  }

  return counts
}

/**
 * Get all projects for the project dropdown
 */
export async function getProjectsForDropdown(): Promise<Array<{ id: string; name: string }>> {
  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(projects.name)

  return results
}

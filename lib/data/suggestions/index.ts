import 'server-only'

import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  taskSuggestions,
  suggestionFeedback,
  emailMetadata,
  projects,
  tasks,
} from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import type {
  TaskSuggestionWithEmail,
  NewSuggestionFeedback,
} from '@/lib/types/suggestions'

/**
 * Get pending suggestions for review
 */
export async function getPendingSuggestions(
  options: { limit?: number; projectId?: string } = {}
): Promise<TaskSuggestionWithEmail[]> {
  const { limit = 50, projectId } = options

  const conditions = [
    eq(taskSuggestions.status, 'PENDING'),
    isNull(taskSuggestions.deletedAt),
  ]

  if (projectId) {
    conditions.push(eq(taskSuggestions.projectId, projectId))
  }

  const results = await db
    .select({
      suggestion: taskSuggestions,
      email: {
        id: emailMetadata.id,
        subject: emailMetadata.subject,
        fromEmail: emailMetadata.fromEmail,
        fromName: emailMetadata.fromName,
        receivedAt: emailMetadata.receivedAt,
      },
      project: {
        id: projects.id,
        name: projects.name,
      },
    })
    .from(taskSuggestions)
    .innerJoin(emailMetadata, eq(emailMetadata.id, taskSuggestions.emailMetadataId))
    .leftJoin(projects, eq(projects.id, taskSuggestions.projectId))
    .where(and(...conditions))
    .orderBy(desc(taskSuggestions.createdAt))
    .limit(limit)

  return results.map(r => ({
    ...r.suggestion,
    email: r.email,
    project: r.project,
  }))
}

/**
 * Get a single suggestion by ID
 */
export async function getSuggestionById(
  suggestionId: string
): Promise<TaskSuggestionWithEmail | null> {
  const [result] = await db
    .select({
      suggestion: taskSuggestions,
      email: {
        id: emailMetadata.id,
        subject: emailMetadata.subject,
        fromEmail: emailMetadata.fromEmail,
        fromName: emailMetadata.fromName,
        receivedAt: emailMetadata.receivedAt,
      },
      project: {
        id: projects.id,
        name: projects.name,
      },
    })
    .from(taskSuggestions)
    .innerJoin(emailMetadata, eq(emailMetadata.id, taskSuggestions.emailMetadataId))
    .leftJoin(projects, eq(projects.id, taskSuggestions.projectId))
    .where(
      and(
        eq(taskSuggestions.id, suggestionId),
        isNull(taskSuggestions.deletedAt)
      )
    )
    .limit(1)

  if (!result) return null

  return {
    ...result.suggestion,
    email: result.email,
    project: result.project,
  }
}

/**
 * Approve a suggestion and create a task
 */
export async function approveSuggestion(
  suggestionId: string,
  userId: string,
  modifications?: {
    title?: string
    description?: string
    projectId?: string
    dueDate?: string
    priority?: string
    status?: 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
  }
): Promise<{ task: typeof tasks.$inferSelect }> {
  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (suggestion.status !== 'PENDING') {
    throw new Error('Suggestion already processed')
  }

  // Determine final values
  const finalTitle = modifications?.title ?? suggestion.suggestedTitle
  const finalDescription = modifications?.description ?? suggestion.suggestedDescription
  const finalProjectId = modifications?.projectId ?? suggestion.projectId
  const finalDueDate = modifications?.dueDate ?? suggestion.suggestedDueDate

  if (!finalProjectId) {
    throw new Error('Project is required')
  }

  // Record feedback for any modifications
  const feedbackRecords: NewSuggestionFeedback[] = []

  if (modifications?.title && modifications.title !== suggestion.suggestedTitle) {
    feedbackRecords.push({
      taskSuggestionId: suggestionId,
      feedbackType: 'title_changed',
      originalValue: suggestion.suggestedTitle,
      correctedValue: modifications.title,
      createdBy: userId,
    })
  }

  if (modifications?.description && modifications.description !== suggestion.suggestedDescription) {
    feedbackRecords.push({
      taskSuggestionId: suggestionId,
      feedbackType: 'description_changed',
      originalValue: suggestion.suggestedDescription || '',
      correctedValue: modifications.description,
      createdBy: userId,
    })
  }

  if (modifications?.projectId && modifications.projectId !== suggestion.projectId) {
    feedbackRecords.push({
      taskSuggestionId: suggestionId,
      feedbackType: 'project_changed',
      originalValue: suggestion.projectId || '',
      correctedValue: modifications.projectId,
      createdBy: userId,
    })
  }

  // Determine final status (default to BACKLOG if not specified)
  const finalStatus = modifications?.status ?? 'BACKLOG'

  // Create task and update suggestion in transaction
  const result = await db.transaction(async tx => {
    // Create the task
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

    // Update suggestion status
    await tx
      .update(taskSuggestions)
      .set({
        status: feedbackRecords.length > 0 ? 'MODIFIED' : 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        createdTaskId: newTask.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(taskSuggestions.id, suggestionId))

    // Record feedback
    if (feedbackRecords.length > 0) {
      await tx.insert(suggestionFeedback).values(feedbackRecords)
    }

    return { task: newTask }
  })

  // Log activity
  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'TASK_CREATED_FROM_EMAIL',
    summary: `Created task "${finalTitle}" from email suggestion`,
    targetType: 'TASK',
    targetId: result.task.id,
    targetProjectId: finalProjectId,
    metadata: {
      suggestionId,
      emailId: suggestion.emailMetadataId,
      wasModified: feedbackRecords.length > 0,
    },
  })

  return result
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

  if (suggestion.status !== 'PENDING') {
    throw new Error('Suggestion already processed')
  }

  await db.transaction(async tx => {
    await tx
      .update(taskSuggestions)
      .set({
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(taskSuggestions.id, suggestionId))

    // Record feedback
    if (reason) {
      await tx.insert(suggestionFeedback).values({
        taskSuggestionId: suggestionId,
        feedbackType: 'rejected',
        originalValue: suggestion.suggestedTitle,
        correctedValue: reason,
        createdBy: userId,
      })
    }
  })

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'TASK_SUGGESTION_REJECTED',
    summary: `Rejected task suggestion "${suggestion.suggestedTitle}"`,
    targetType: 'TASK',
    targetId: suggestionId,
    metadata: { reason },
  })
}

/**
 * Get suggestion counts by status
 */
export async function getSuggestionCounts(): Promise<{
  pending: number
  approved: number
  rejected: number
}> {
  const results = await db
    .select({
      status: taskSuggestions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(taskSuggestions)
    .where(isNull(taskSuggestions.deletedAt))
    .groupBy(taskSuggestions.status)

  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const r of results) {
    if (r.status === 'PENDING') counts.pending = r.count
    if (r.status === 'APPROVED' || r.status === 'MODIFIED') counts.approved += r.count
    if (r.status === 'REJECTED') counts.rejected = r.count
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

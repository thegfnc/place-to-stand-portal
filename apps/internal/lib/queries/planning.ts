import { eq, and, asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
  projects,
  tasks,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * A task's planning session, regardless of status. `status` is a display
 * flag ('active' = still drafting, 'deployed' = dispatched at least once) —
 * the session and its chat history stay reusable either way, so lookup must
 * not filter it out once deployed.
 */
export async function getSessionByTaskId(taskId: string) {
  const [session] = await db
    .select()
    .from(planningSessions)
    .where(eq(planningSessions.taskId, taskId))
    .orderBy(desc(planningSessions.createdAt))
    .limit(1)

  return session ?? null
}

export async function createSession(
  taskId: string,
  repoLinkId: string,
  userId: string
) {
  const [session] = await db
    .insert(planningSessions)
    .values({ taskId, repoLinkId, createdBy: userId })
    .returning()

  return session
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'deployed'
) {
  await db
    .update(planningSessions)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(planningSessions.id, sessionId))
}

/**
 * Activity-log context for a thread: the owning session plus the task's
 * project/client so PLAN events land in the right feeds.
 */
export async function getPlanningContextForThread(threadId: string) {
  const [row] = await db
    .select({
      sessionId: planThreads.sessionId,
      taskId: tasks.id,
      taskTitle: tasks.title,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(planThreads)
    .innerJoin(planningSessions, eq(planningSessions.id, planThreads.sessionId))
    .innerJoin(tasks, eq(tasks.id, planningSessions.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(planThreads.id, threadId))
    .limit(1)

  return row ?? null
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export async function getThreadById(threadId: string) {
  const [thread] = await db
    .select()
    .from(planThreads)
    .where(eq(planThreads.id, threadId))
    .limit(1)

  return thread ?? null
}

export async function getThreadsForSession(sessionId: string) {
  return db
    .select()
    .from(planThreads)
    .where(eq(planThreads.sessionId, sessionId))
    .orderBy(asc(planThreads.createdAt))
}

export async function createThread(
  sessionId: string,
  model: string,
  modelLabel: string
) {
  const [thread] = await db
    .insert(planThreads)
    .values({ sessionId, model, modelLabel })
    .returning()

  return thread
}

export async function updateThreadVersion(
  threadId: string,
  currentVersion: number
) {
  await db
    .update(planThreads)
    .set({ currentVersion })
    .where(eq(planThreads.id, threadId))
}

// ---------------------------------------------------------------------------
// Generation status (lets the frontend detect and resume an in-flight or
// just-finished generation after navigating away mid-stream and back)
// ---------------------------------------------------------------------------

export async function startThreadGeneration(threadId: string, version: number) {
  await db
    .update(planThreads)
    .set({
      generationStatus: 'streaming',
      generatingVersion: version,
      partialContent: '',
      generationError: null,
    })
    .where(eq(planThreads.id, threadId))
}

export async function updateThreadPartialContent(
  threadId: string,
  partialContent: string
) {
  await db
    .update(planThreads)
    .set({ partialContent })
    .where(eq(planThreads.id, threadId))
}

export async function finishThreadGeneration(threadId: string) {
  await db
    .update(planThreads)
    .set({ generationStatus: 'idle' })
    .where(eq(planThreads.id, threadId))
}

export async function failThreadGeneration(threadId: string, error: string) {
  await db
    .update(planThreads)
    .set({ generationStatus: 'error', generationError: error })
    .where(eq(planThreads.id, threadId))
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

export async function getRevisions(threadId: string) {
  return db
    .select()
    .from(planRevisions)
    .where(eq(planRevisions.threadId, threadId))
    .orderBy(asc(planRevisions.version))
}

export async function getRevisionByVersion(threadId: string, version: number) {
  const [revision] = await db
    .select()
    .from(planRevisions)
    .where(
      and(
        eq(planRevisions.threadId, threadId),
        eq(planRevisions.version, version)
      )
    )
    .limit(1)

  return revision ?? null
}

export async function createRevision(
  threadId: string,
  version: number,
  content: string,
  feedback?: string
) {
  const [revision] = await db
    .insert(planRevisions)
    .values({ threadId, version, content, feedback })
    .returning()

  return revision
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(threadId: string) {
  return db
    .select()
    .from(planMessages)
    .where(eq(planMessages.threadId, threadId))
    .orderBy(asc(planMessages.createdAt))
}

export async function appendMessage(
  threadId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  const [message] = await db
    .insert(planMessages)
    .values({ threadId, role, content, metadata })
    .returning()

  return message
}

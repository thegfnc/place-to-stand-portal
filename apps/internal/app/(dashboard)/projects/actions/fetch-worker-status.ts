'use server'

import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

import { taskWorkerStatusChangedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks, taskDeployments, projects } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getRepoLinkById } from '@/lib/data/github-repos'
import { listIssueComments, resolveRepoLinkAuth, type GitHubComment } from '@/lib/github/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerCommentStatus =
  | 'working'
  | 'plan_ready'
  | 'implementing'
  | 'pr_created'
  | 'error'
  | 'cancelled'
  | 'unknown'

export type WorkerComment = {
  id: number
  body: string
  login: string
  avatarUrl: string
  createdAt: string
  htmlUrl: string
  status: WorkerCommentStatus
  isBot: boolean
}

export type WorkerStatusResult =
  | {
      comments: WorkerComment[]
      prUrl: string | null
      latestStatus: WorkerCommentStatus | null
    }
  | { error: string }

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const WORKER_BOT_LOGIN = 'place-to-stand[bot]'
const PR_URL_REGEX = /\*\*Pull request:\*\*\s+(https:\/\/github\.com\/\S+)/
const PLAN_HEADING = '## Implementation Plan'
const WORKING_PATTERNS = ['Agent working', 'Planning...', '🔄', 'Working on']
const ERROR_PATTERNS = ['**Agent failed**', '**Budget limit**', '❌ Agent failed', '❌ Budget']

function classifyWorkerComment(body: string): WorkerCommentStatus {
  if (ERROR_PATTERNS.some(p => body.includes(p))) return 'error'
  if (PR_URL_REGEX.test(body)) return 'pr_created'
  if (body.includes(PLAN_HEADING)) return 'plan_ready'
  if (WORKING_PATTERNS.some(p => body.includes(p))) return 'working'
  return 'unknown'
}

function extractPrUrl(comments: WorkerComment[]): string | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const match = comments[i].body.match(PR_URL_REGEX)
    if (match) return match[1]
  }
  return null
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

const fetchSchema = z.object({
  deploymentId: z.string().uuid(),
})

/**
 * Fetch the current worker status for a deployment by reading GitHub issue comments.
 */
export async function fetchWorkerStatus(input: {
  deploymentId: string
}): Promise<WorkerStatusResult> {
  const user = await requireUser()

  const parsed = fetchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { deploymentId } = parsed.data

  // Load deployment
  const [deployment] = await db
    .select()
    .from(taskDeployments)
    .where(eq(taskDeployments.id, deploymentId))
    .limit(1)

  if (!deployment) return { error: 'Deployment not found.' }

  // Auth check
  try {
    await ensureTaskAccess(user, deployment.taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('fetchWorkerStatus auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  // Load repo link
  const repoLink = await getRepoLinkById(deployment.repoLinkId)
  if (!repoLink) return { error: 'Repository link not found.' }

  let repoAuth: { token: string }
  try {
    repoAuth = await resolveRepoLinkAuth(user.id, repoLink)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to resolve GitHub credentials.',
    }
  }

  let rawComments: GitHubComment[]
  try {
    rawComments = await listIssueComments(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      deployment.githubIssueNumber,
      repoAuth
    )
  } catch (error) {
    console.error('Failed to fetch issue comments', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to fetch issue comments.',
    }
  }

  // Map all comments, classifying bot comments and marking others
  const allComments: WorkerComment[] = rawComments.map(c => {
    const isBot = c.user.login === WORKER_BOT_LOGIN
    return {
      id: c.id,
      body: c.body,
      login: c.user.login,
      avatarUrl: c.user.avatar_url,
      createdAt: c.created_at,
      htmlUrl: c.html_url,
      status: isBot ? classifyWorkerComment(c.body) : 'unknown',
      isBot,
    }
  })

  // Post-process: reclassify 'working' bot comments as 'implementing' when
  // the preceding user command was an implement/execute request (no /plan flag).
  for (let i = 0; i < allComments.length; i++) {
    if (allComments[i].isBot && allComments[i].status === 'working') {
      // Walk backwards to find the nearest preceding user command
      for (let j = i - 1; j >= 0; j--) {
        if (!allComments[j].isBot && allComments[j].body.includes('@pts-worker')) {
          if (!allComments[j].body.includes('/plan')) {
            allComments[i].status = 'implementing'
          }
          break
        }
      }
    }
  }

  const botComments = allComments.filter(c => c.isBot)
  const prUrl = extractPrUrl(botComments)
  const latestStatus =
    botComments.length > 0
      ? botComments[botComments.length - 1].status
      : null

  // Persist the latest worker status to the deployment
  if (latestStatus && latestStatus !== 'unknown') {
    const previousStatus = deployment.workerStatus

    await db
      .update(taskDeployments)
      .set({ workerStatus: latestStatus, prUrl: prUrl, updatedAt: new Date().toISOString() })
      .where(eq(taskDeployments.id, deploymentId))

    // This poll runs constantly; only a real transition is an event.
    if (previousStatus !== latestStatus) {
      const [task] = await db
        .select({
          title: tasks.title,
          projectId: tasks.projectId,
          clientId: projects.clientId,
        })
        .from(tasks)
        .leftJoin(projects, eq(projects.id, tasks.projectId))
        .where(eq(tasks.id, deployment.taskId))
        .limit(1)

      const event = taskWorkerStatusChangedEvent({
        taskTitle: task?.title ?? 'Untitled task',
        issueNumber: deployment.githubIssueNumber,
        before: previousStatus,
        after: latestStatus,
      })
      await logActivity({
        actorId: null,
        source: 'SYSTEM',
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: deployment.taskId,
        targetProjectId: task?.projectId ?? null,
        targetClientId: task?.clientId ?? null,
        metadata: event.metadata,
      })
    }

    // Sync task cached fields if this is the latest deployment
    const [latest] = await db
      .select({ id: taskDeployments.id })
      .from(taskDeployments)
      .where(eq(taskDeployments.taskId, deployment.taskId))
      .orderBy(desc(taskDeployments.createdAt))
      .limit(1)

    if (latest && latest.id === deploymentId) {
      await db
        .update(tasks)
        .set({
          workerStatus: latestStatus,
          githubIssueNumber: deployment.githubIssueNumber,
          githubIssueUrl: deployment.githubIssueUrl,
        })
        .where(eq(tasks.id, deployment.taskId))
    }
  }

  return { comments: botComments, prUrl, latestStatus }
}

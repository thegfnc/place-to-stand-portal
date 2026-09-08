import 'server-only'

import { revalidateProjectTaskViews } from '@/app/(dashboard)/projects/actions/shared'
import type { AppUser } from '@/lib/auth/session'
import { resolveProjectIdentifier } from '@/lib/data/projects'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import type { SaveTaskResult } from '@/lib/tasks/types'

import { jsonOk } from './handler'
import { loadTaskForEdit } from './queries/tasks'
import { serializeTask, type CliTask } from './serializers/task'

/**
 * Accepts a project UUID or slug. Slugs are safe to resolve without client
 * scope: `projects.slug` carries a global unique index (packages/db schema,
 * `idx_projects_slug`). A project with no slug is reachable by id only.
 */
export async function resolveProjectId(
  user: AppUser,
  identifier: string
): Promise<string> {
  const project = await resolveProjectIdentifier(user, identifier)

  return project.resolvedId
}

async function loadSerializedTask(
  user: AppUser,
  taskId: string
): Promise<CliTask> {
  const { task, assigneeIds } = await loadTaskForEdit(user, taskId)

  return serializeTask(task, assigneeIds)
}

/**
 * Turns a `SaveTaskResult` into an HTTP response, honouring the partial-failure
 * contract: a result carrying `taskId` means the row was written even when an
 * `error` rides along, so it must not come back as a 4xx that invites a retry —
 * a retried create would duplicate the task. Those surface as success with a
 * `warning` instead.
 */
export async function respondToTaskWrite(
  user: AppUser,
  result: SaveTaskResult,
  status: number
) {
  if (!result.taskId) {
    // No row was written. `saveTaskForActor` returns prose for these, and they
    // are all caller-fixable (bad project, missing task, invalid payload).
    if (result.error === 'Task not found.') {
      throw new NotFoundError(result.error)
    }

    throw new BadRequestError(result.error ?? 'Unable to save task.')
  }

  await revalidateProjectTaskViews()

  const task = await loadSerializedTask(user, result.taskId)

  return jsonOk(task, { status, warning: result.error })
}

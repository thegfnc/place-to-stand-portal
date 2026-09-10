import { toRichTextHtml } from '@/lib/cli/description'
import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { loadTaskForEdit } from '@/lib/cli/queries/tasks'
import { cliUpdateTaskSchema } from '@/lib/cli/schemas/tasks'
import { resolveUserIds } from '@/lib/cli/queries/users'
import {
  loadSerializedTask,
  resolveProjectId,
  respondToTaskWrite,
} from '@/lib/cli/tasks'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'

type Params = { taskId: string }

export const GET = withCliAuth<Params>(async ({ user, params }) =>
  loadSerializedTask(user, params.taskId)
)

/**
 * Partial update. The underlying save is a full replace, so anything the caller
 * omits is read back from the current row and sent unchanged — otherwise
 * `PATCH {title}` would blank the description and drop every assignee.
 *
 * An explicit `null` still clears a field; `undefined` (omitted) preserves it.
 */
export const PATCH = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = cliUpdateTaskSchema.parse(await readJsonBody(request))
  const { task, assigneeIds } = await loadTaskForEdit(user, params.taskId)

  const projectId = payload.project
    ? await resolveProjectId(user, payload.project)
    : task.projectId

  const result = await saveTaskForActor(user, {
    id: task.id,
    projectId,
    title: payload.title ?? task.title,
    description:
      payload.description === undefined
        ? task.description
        : payload.description === null
          ? null
          : toRichTextHtml(payload.description),
    status: payload.status ?? task.status,
    dueOn: payload.dueOn === undefined ? task.dueOn : payload.dueOn,
    assigneeIds:
      payload.assigneeIds === undefined
        ? assigneeIds
        : await resolveUserIds(user, payload.assigneeIds),
    leadId: payload.leadId === undefined ? task.leadId : payload.leadId,
  }, 'CLI')

  return respondToTaskWrite(user, result, 200)
})

import { toRichTextHtml } from '@/lib/cli/description'
import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import {
  fetchAssigneeIdsByTask,
  fetchBoardLocationsByProject,
  listTasksForCli,
} from '@/lib/cli/queries/tasks'
import {
  cliCreateTaskSchema,
  cliTaskListQuerySchema,
} from '@/lib/cli/schemas/tasks'
import { serializeTask } from '@/lib/cli/serializers/task'
import { resolveUserIds } from '@/lib/cli/queries/users'
import { resolveProjectId, respondToTaskWrite } from '@/lib/cli/tasks'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliTaskListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const projectId = query.project
    ? await resolveProjectId(user, query.project)
    : undefined

  const rows = await listTasksForCli(user, {
    projectId,
    status: query.status,
    assigneeId: query.assignee,
    limit: query.limit,
  })

  const [assignees, locations] = await Promise.all([
    fetchAssigneeIdsByTask(rows.map(row => row.id)),
    fetchBoardLocationsByProject(rows.map(row => row.projectId)),
  ])

  return rows.map(row =>
    serializeTask(
      row,
      assignees.get(row.id) ?? [],
      locations.get(row.projectId) ?? null
    )
  )
})

export const POST = withCliAuth(async ({ user, request }) => {
  const payload = cliCreateTaskSchema.parse(await readJsonBody(request))
  const projectId = await resolveProjectId(user, payload.project)
  const assigneeIds = await resolveUserIds(user, payload.assigneeIds)

  const result = await saveTaskForActor(user, {
    projectId,
    title: payload.title,
    description: payload.description
      ? toRichTextHtml(payload.description)
      : null,
    status: payload.status,
    dueOn: payload.dueOn ?? null,
    assigneeIds,
    leadId: payload.leadId ?? null,
  }, 'CLI')

  return respondToTaskWrite(user, result, 201)
})

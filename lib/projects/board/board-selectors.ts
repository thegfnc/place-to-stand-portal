import type { TaskWithRelations } from '@/lib/types'

type MemberDirectoryEntry = {
  name: string
}

export type TaskMemberDirectory = Map<string, MemberDirectoryEntry>

export type RenderAssigneeFn = (task: TaskWithRelations) => Array<{
  id: string
  name: string
}>

export function createRenderAssignees(
  directory: TaskMemberDirectory
): RenderAssigneeFn {
  return task => {
    const seen = new Set<string>()

    return task.assignees
      .map(assignee => {
        if (seen.has(assignee.user_id)) {
          return null
        }

        seen.add(assignee.user_id)
        const entry = directory.get(assignee.user_id)

        return {
          id: assignee.user_id,
          name: entry?.name ?? 'Unknown',
        }
      })
      .filter((assignee): assignee is { id: string; name: string } =>
        Boolean(assignee)
      )
  }
}

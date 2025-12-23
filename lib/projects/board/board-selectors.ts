import type { TaskWithRelations } from '@/lib/types'

type MemberDirectoryEntry = {
  name: string
  avatarUrl: string | null
}

export type TaskMemberDirectory = Map<string, MemberDirectoryEntry>

export type RenderAssigneeFn = (task: TaskWithRelations) => Array<{
  id: string
  name: string
  avatarUrl: string | null
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
          avatarUrl: entry?.avatarUrl ?? null,
        }
      })
      .filter(
        (
          assignee
        ): assignee is { id: string; name: string; avatarUrl: string | null } =>
          Boolean(assignee)
      )
  }
}

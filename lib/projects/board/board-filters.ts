import type { TaskWithRelations } from '@/lib/types'

export function filterTasksByAssignee(
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>,
  userId: string | null
): Map<string, TaskWithRelations[]> {
  if (!userId) {
    return new Map(tasksByColumn)
  }

  const filtered = new Map<string, TaskWithRelations[]>()

  tasksByColumn.forEach((columnTasks, columnId) => {
    const matchingTasks = columnTasks.filter(task =>
      task.assignees.some(assignee => assignee.user_id === userId)
    )

    filtered.set(columnId, matchingTasks)
  })

  return filtered
}

import { useMemo } from 'react'

import { BACKLOG_SECTIONS } from '@/lib/projects/board/board-constants'
import { filterTasksByAssignee } from '@/lib/projects/board/board-filters'
import { groupTasksByColumn } from '@/lib/projects/board/board-utils'
import type { TaskWithRelations } from '@/lib/types'

export type ProjectsBoardDerivedStateArgs = {
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  tasksByColumn: Map<string, TaskWithRelations[]>
  onlyAssignedToMe: boolean
  currentUserId: string | null
  canAcceptTasks: boolean
}

export type ProjectsBoardDerivedState = {
  onDeckTasks: TaskWithRelations[]
  backlogTasks: TaskWithRelations[]
  tasksByColumnToRender: Map<string, TaskWithRelations[]>
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  doneColumnTasks: TaskWithRelations[]
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
}

export function useProjectsBoardDerivedState({
  activeProjectTasks,
  activeProjectArchivedTasks,
  tasksByColumn,
  onlyAssignedToMe,
  currentUserId,
  canAcceptTasks,
}: ProjectsBoardDerivedStateArgs): ProjectsBoardDerivedState {
  const backlogGroups = useMemo(() => {
    const groups = groupTasksByColumn(activeProjectTasks, BACKLOG_SECTIONS)
    return {
      onDeck: groups.get('ON_DECK') ?? [],
      backlog: groups.get('BACKLOG') ?? [],
    }
  }, [activeProjectTasks])

  const tasksByColumnToRender = useMemo(() => {
    if (!onlyAssignedToMe || !currentUserId) {
      return tasksByColumn
    }

    return filterTasksByAssignee(tasksByColumn, currentUserId)
  }, [onlyAssignedToMe, currentUserId, tasksByColumn])

  const acceptedTasks = useMemo(
    () =>
      activeProjectTasks.filter(
        task => task.status === 'DONE' && Boolean(task.accepted_at)
      ),
    [activeProjectTasks]
  )

  const doneColumnTasks = useMemo(
    () => tasksByColumnToRender.get('DONE') ?? [],
    [tasksByColumnToRender]
  )

  const hasAcceptableTasks = doneColumnTasks.length > 0
  const acceptAllDisabled = !canAcceptTasks || !hasAcceptableTasks
  const acceptAllDisabledReason = !canAcceptTasks
    ? 'Only administrators can accept tasks.'
    : !hasAcceptableTasks
      ? 'No tasks are ready for acceptance.'
      : null

  return {
    onDeckTasks: backlogGroups.onDeck,
    backlogTasks: backlogGroups.backlog,
    tasksByColumnToRender,
    acceptedTasks,
    archivedTasks: activeProjectArchivedTasks,
    doneColumnTasks,
    acceptAllDisabled,
    acceptAllDisabledReason,
  }
}

'use client'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

import { TaskSheet } from '../task-sheet'
import { ProjectTimeLogDialog } from './project-time-log/project-time-log-dialog'
import { ProjectTimeLogHistoryDialog } from './project-time-log-history-dialog'

type SheetState = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskWithRelations | undefined
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  currentUserRole: UserRole
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
}

type TimeLogState = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canLogTime: boolean
  timeLogProjectId: string | null
  tasks: TaskWithRelations[]
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
}

type TimeLogHistoryState = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  viewTimeLogsProjectId: string | null
  currentUserId: string
  currentUserRole: UserRole
}

export type ProjectsBoardDialogsProps = {
  activeProject: ProjectWithRelations | null
  sheetState: SheetState
  timeLogState: TimeLogState
  timeLogHistoryState: TimeLogHistoryState
}

export function ProjectsBoardDialogs({
  activeProject,
  sheetState,
  timeLogState,
  timeLogHistoryState,
}: ProjectsBoardDialogsProps) {
  if (!activeProject) {
    return null
  }

  const {
    open,
    onOpenChange,
    task,
    canManage,
    admins,
    currentUserId,
    currentUserRole,
    defaultStatus,
    defaultDueOn,
  } = sheetState

  const {
    isOpen: isTimeLogOpen,
    onOpenChange: onTimeLogOpenChange,
    canLogTime,
    timeLogProjectId,
    tasks,
    currentUserId: timeLogUserId,
    currentUserRole: timeLogUserRole,
    admins: timeLogAdmins,
  } = timeLogState

  const {
    isOpen: isHistoryOpen,
    onOpenChange: onHistoryOpenChange,
    viewTimeLogsProjectId,
    currentUserId: historyUserId,
    currentUserRole: historyUserRole,
  } = timeLogHistoryState

  const timeLogDialogOpen =
    canLogTime && isTimeLogOpen && timeLogProjectId === activeProject.id

  const timeLogHistoryOpen =
    isHistoryOpen && viewTimeLogsProjectId === activeProject.id

  return (
    <>
      <TaskSheet
        open={open}
        onOpenChange={onOpenChange}
        project={activeProject}
        task={task}
        canManage={canManage}
        admins={admins}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        defaultStatus={defaultStatus}
        defaultDueOn={defaultDueOn}
      />

      <ProjectTimeLogDialog
        open={timeLogDialogOpen}
        onOpenChange={onTimeLogOpenChange}
        projectId={activeProject.id}
        projectName={activeProject.name}
        clientId={activeProject.client?.id ?? null}
        clientName={activeProject.client?.name ?? null}
        clientRemainingHours={activeProject.burndown.totalClientRemainingHours}
        tasks={tasks}
        currentUserId={timeLogUserId}
        currentUserRole={timeLogUserRole}
        projectMembers={activeProject.members}
        admins={timeLogAdmins}
      />

      <ProjectTimeLogHistoryDialog
        open={timeLogHistoryOpen}
        onOpenChange={onHistoryOpenChange}
        projectId={activeProject.id}
        projectName={activeProject.name}
        clientName={activeProject.client?.name ?? null}
        currentUserId={historyUserId}
        currentUserRole={historyUserRole}
      />
    </>
  )
}

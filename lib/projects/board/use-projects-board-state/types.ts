import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

import type { BoardColumnId } from '../board-constants'
import type { useBoardDnDState } from '../state/use-board-dnd'
import type { useBoardNavigation } from '../state/use-board-navigation'
import type { useBoardSheetState } from '../state/use-board-sheet-state'
import type { useCalendarDnDState } from '../../calendar/state/use-calendar-dnd-state'

export type UseProjectsBoardStateArgs = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
  activeClientId: string | null
  activeProjectId: string | null
  activeTaskId: string | null
  currentView: 'board' | 'calendar' | 'activity' | 'backlog' | 'review'
}

export type MemberDirectoryEntry = { name: string }

export type ProjectsBoardState = {
  isPending: boolean
  feedback: string | null
  selectedProjectId: string | null
  projectItems: Array<{ value: string; label: string; keywords: string[] }>
  canSelectNextProject: boolean
  canSelectPreviousProject: boolean
  activeProject: ProjectWithRelations | null
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  activeProjectAcceptedTasks: TaskWithRelations[]
  canManageTasks: boolean
  memberDirectory: Map<string, MemberDirectoryEntry>
  tasksByColumn: Map<string, TaskWithRelations[]>
  draggingTask: TaskWithRelations | null
  calendarDraggingTask: TaskWithRelations | null
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  isSheetOpen: boolean
  sheetTask: TaskWithRelations | undefined
  scrimLocked: boolean
  handleProjectSelect: (projectId: string | null) => void
  handleSelectNextProject: () => void
  handleSelectPreviousProject: () => void
  handleDragStart: ReturnType<typeof useBoardDnDState>['handleDragStart']
  handleDragOver: ReturnType<typeof useBoardDnDState>['handleDragOver']
  handleDragEnd: ReturnType<typeof useBoardDnDState>['handleDragEnd']
  handleCalendarDragStart: ReturnType<
    typeof useCalendarDnDState
  >['handleDragStart']
  handleCalendarDragEnd: ReturnType<typeof useCalendarDnDState>['handleDragEnd']
  openCreateSheet: ReturnType<typeof useBoardSheetState>['openCreateSheet']
  handleEditTask: ReturnType<typeof useBoardSheetState>['handleEditTask']
  handleSheetOpenChange: ReturnType<
    typeof useBoardSheetState
  >['handleSheetOpenChange']
  defaultTaskStatus: BoardColumnId
  defaultTaskDueOn: string | null
  navigateToProject: ReturnType<typeof useBoardNavigation>
  activeDropColumnId: ReturnType<typeof useBoardDnDState>['activeDropColumnId']
  dropPreview: ReturnType<typeof useBoardDnDState>['dropPreview']
  recentlyMovedTaskId: ReturnType<
    typeof useBoardDnDState
  >['recentlyMovedTaskId']
}

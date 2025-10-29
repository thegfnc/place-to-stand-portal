'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEventHandler,
} from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import type { TaskWithRelations } from '@/lib/types'
import { BOARD_COLUMNS } from '@/lib/projects/board/board-constants'
import { useProjectsBoardState } from '@/lib/projects/board/use-projects-board-state'

import { KanbanColumn } from './_components/kanban-column'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { TaskDragOverlay } from './_components/task-drag-overlay'
import { TaskSheet } from './task-sheet'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectsBoardIntro } from './_components/projects-board-intro'
import { ProjectTimeLogDialog } from './_components/project-time-log-dialog'
import { ProjectTimeLogHistoryDialog } from './_components/project-time-log-history-dialog'

type Props = Parameters<typeof useProjectsBoardState>[0]

const NO_PROJECTS_TITLE = 'No projects assigned yet'
const NO_PROJECTS_DESCRIPTION =
  'Once an administrator links you to a project, the workspace will unlock here.'
const NO_SELECTION_TITLE = 'No project selected'
const NO_SELECTION_DESCRIPTION =
  'Choose a client and project above to view the associated tasks.'

export function ProjectsBoard(props: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const {
    isPending,
    feedback,
    selectedClientId,
    selectedProjectId,
    clientItems,
    projectItems,
    activeProject,
    activeProjectTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    draggingTask,
    addTaskDisabled,
    addTaskDisabledReason,
    isSheetOpen,
    sheetTask,
    scrimLocked,
    handleClientSelect,
    handleProjectSelect,
    handleDragStart,
    handleDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
  } = useProjectsBoardState(props)

  const isClientView = props.currentUserRole === 'CLIENT'
  const canLogTime = props.currentUserRole !== 'CLIENT'
  const addTimeLogDisabledReason = canLogTime
    ? null
    : 'Clients can review logged hours but cannot add new entries.'

  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false)
  const [timeLogProjectId, setTimeLogProjectId] = useState<string | null>(null)
  const [isViewTimeLogsOpen, setIsViewTimeLogsOpen] = useState(false)
  const [viewTimeLogsProjectId, setViewTimeLogsProjectId] = useState<
    string | null
  >(null)

  const handleTimeLogDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      if (!canLogTime) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      if (!activeProject) {
        setIsTimeLogDialogOpen(false)
        setTimeLogProjectId(null)
        return
      }

      setTimeLogProjectId(activeProject.id)
      setIsTimeLogDialogOpen(true)
    },
    [activeProject, canLogTime]
  )

  const handleViewTimeLogsDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsViewTimeLogsOpen(false)
        setViewTimeLogsProjectId(null)
        return
      }

      if (!activeProject) {
        setIsViewTimeLogsOpen(false)
        setViewTimeLogsProjectId(null)
        return
      }

      setViewTimeLogsProjectId(activeProject.id)
      setIsViewTimeLogsOpen(true)
    },
    [activeProject]
  )

  const boardViewportRef = useRef<HTMLDivElement | null>(null)

  const boardScrollKey = useMemo(() => {
    if (!activeProject?.id) return null
    return `projects-board-scroll:${activeProject.id}`
  }, [activeProject?.id])

  const persistBoardScroll = useCallback(() => {
    if (!boardScrollKey) {
      return
    }

    const node = boardViewportRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(boardScrollKey, String(node.scrollLeft))
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }, [boardScrollKey])

  const handleBoardScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
    persistBoardScroll()
  }, [persistBoardScroll])

  useEffect(() => {
    if (!boardScrollKey) {
      return
    }

    const node = boardViewportRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.sessionStorage.getItem(boardScrollKey)
        const parsed = stored ? Number(stored) : NaN
        if (!Number.isNaN(parsed)) {
          node.scrollLeft = parsed
        }
      } catch {
        // Ignore storage failures (private browsing, quota, etc.)
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
      persistBoardScroll()
    }
  }, [boardScrollKey, persistBoardScroll])

  const renderAssignees = useCallback(
    (task: TaskWithRelations) => {
      const seen = new Set<string>()
      return task.assignees
        .map(assignee => {
          if (seen.has(assignee.user_id)) {
            return null
          }
          seen.add(assignee.user_id)
          return {
            id: assignee.user_id,
            name: memberDirectory.get(assignee.user_id)?.name ?? 'Unknown',
          }
        })
        .filter((assignee): assignee is { id: string; name: string } =>
          Boolean(assignee)
        )
    },
    [memberDirectory]
  )

  if (props.projects.length === 0) {
    return (
      <>
        <AppShellHeader>
          <ProjectsBoardHeader
            clientItems={clientItems}
            projectItems={projectItems}
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            onClientChange={handleClientSelect}
            onProjectChange={handleProjectSelect}
          />
        </AppShellHeader>
        <div className='flex h-full flex-col gap-6'>
          <ProjectsBoardIntro
            addTaskDisabled
            addTaskDisabledReason='Select a project to add tasks.'
            onAddTask={openCreateSheet}
            isClientView={isClientView}
          />
          <ProjectsBoardEmpty
            title={NO_PROJECTS_TITLE}
            description={NO_PROJECTS_DESCRIPTION}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <AppShellHeader>
        <ProjectsBoardHeader
          clientItems={clientItems}
          projectItems={projectItems}
          selectedClientId={selectedClientId}
          selectedProjectId={selectedProjectId}
          onClientChange={handleClientSelect}
          onProjectChange={handleProjectSelect}
        />
      </AppShellHeader>
      <div className='flex h-full min-h-0 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          {activeProject ? (
            <ProjectBurndownWidget
              totalClientRemainingHours={
                activeProject.burndown.totalClientRemainingHours
              }
              totalProjectLoggedHours={
                activeProject.burndown.totalProjectLoggedHours
              }
              className='shrink-0'
              canLogTime={canLogTime}
              addTimeLogDisabledReason={addTimeLogDisabledReason}
              onViewTimeLogs={() => handleViewTimeLogsDialogOpenChange(true)}
              onAddTimeLog={() => handleTimeLogDialogOpenChange(true)}
            />
          ) : null}
          <ProjectsBoardIntro
            addTaskDisabled={addTaskDisabled}
            addTaskDisabledReason={addTaskDisabledReason}
            onAddTask={openCreateSheet}
            isClientView={isClientView}
          />
        </div>
        {feedback ? (
          <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
            {feedback}
          </p>
        ) : null}
        {!activeProject ? (
          <ProjectsBoardEmpty
            title={NO_SELECTION_TITLE}
            description={NO_SELECTION_DESCRIPTION}
          />
        ) : (
          <div className='relative min-h-0 flex-1'>
            <div className='absolute inset-0 overflow-hidden'>
              <div
                ref={boardViewportRef}
                className='h-full min-h-0 overflow-x-auto'
                onScroll={handleBoardScroll}
              >
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className='flex h-full w-max gap-4 p-1'>
                    {BOARD_COLUMNS.map(column => (
                      <KanbanColumn
                        key={column.id}
                        columnId={column.id}
                        label={column.label}
                        tasks={tasksByColumn.get(column.id) ?? []}
                        renderAssignees={renderAssignees}
                        onEditTask={handleEditTask}
                        canManage={canManageTasks}
                        activeTaskId={sheetTask?.id ?? null}
                      />
                    ))}
                  </div>
                  <TaskDragOverlay
                    draggingTask={draggingTask}
                    renderAssignees={renderAssignees}
                  />
                </DndContext>
              </div>
            </div>
            {isPending && !scrimLocked ? (
              <div className='bg-background/60 pointer-events-none absolute inset-0 flex items-center justify-center'>
                <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
              </div>
            ) : null}
          </div>
        )}
        {activeProject ? (
          <TaskSheet
            open={isSheetOpen}
            onOpenChange={handleSheetOpenChange}
            project={activeProject}
            task={sheetTask}
            canManage={canManageTasks}
            admins={props.admins}
            currentUserId={props.currentUserId}
            currentUserRole={props.currentUserRole}
          />
        ) : null}
        {activeProject ? (
          <ProjectTimeLogDialog
            open={
              Boolean(activeProject) &&
              isTimeLogDialogOpen &&
              canLogTime &&
              timeLogProjectId === activeProject.id
            }
            onOpenChange={handleTimeLogDialogOpenChange}
            projectId={activeProject.id}
            projectName={activeProject.name}
            clientName={activeProject.client?.name ?? null}
            clientRemainingHours={
              activeProject.burndown.totalClientRemainingHours
            }
            tasks={activeProjectTasks}
            currentUserId={props.currentUserId}
            currentUserRole={props.currentUserRole}
            projectMembers={activeProject.members}
            admins={props.admins}
          />
        ) : null}
        {activeProject ? (
          <ProjectTimeLogHistoryDialog
            open={
              Boolean(activeProject) &&
              isViewTimeLogsOpen &&
              viewTimeLogsProjectId === activeProject.id
            }
            onOpenChange={handleViewTimeLogsDialogOpenChange}
            projectId={activeProject.id}
            projectName={activeProject.name}
            clientName={activeProject.client?.name ?? null}
            currentUserId={props.currentUserId}
            currentUserRole={props.currentUserRole}
          />
        ) : null}
      </div>
    </>
  )
}

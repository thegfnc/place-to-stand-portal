'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectTimeLogDialog } from './_components/project-time-log/project-time-log-dialog'
import { ProjectTimeLogHistoryDialog } from './_components/project-time-log-history-dialog'
import { ProjectsBoardTabs } from './_components/projects-board/projects-board-tabs'
import { TaskSheet } from './task-sheet'

import { BACKLOG_SECTIONS } from '@/lib/projects/board/board-constants'
import { createRenderAssignees } from '@/lib/projects/board/board-selectors'
import { filterTasksByAssignee } from '@/lib/projects/board/board-filters'
import { useBoardAssignedFilter } from '@/lib/projects/board/state/use-board-assigned-filter'
import { useBoardScrollPersistence } from '@/lib/projects/board/state/use-board-scroll-persistence'
import { useBoardTimeLogDialogs } from '@/lib/projects/board/state/use-board-time-log-dialogs'
import { groupTasksByColumn } from '@/lib/projects/board/board-utils'
import { useProjectsBoardState } from '@/lib/projects/board/use-projects-board-state'
import { useToast } from '@/components/ui/use-toast'
import {
  acceptDoneTasks,
  acceptTask,
  destroyTask,
  restoreTask,
  unacceptTask,
} from './actions'
import type { ActionResult } from './actions/action-types'
import { calendarTasksQueryRoot } from '@/lib/projects/calendar/use-calendar-month-tasks'

type Props = Omit<Parameters<typeof useProjectsBoardState>[0], 'currentView'>
type ProjectsBoardProps = Props & {
  initialTab?: 'board' | 'calendar' | 'activity' | 'refine' | 'review'
}

type ReviewActionKind = 'accept' | 'unaccept' | 'restore' | 'destroy'
type ReviewActionState = { type: ReviewActionKind; taskId: string }

const NO_PROJECTS_TITLE = 'No projects assigned yet'
const NO_PROJECTS_DESCRIPTION =
  'Once an administrator links you to a project, the workspace will unlock here.'

export function ProjectsBoard({
  initialTab = 'board',
  ...props
}: ProjectsBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    isPending,
    feedback,
    selectedClientId,
    selectedProjectId,
    clientItems,
    projectItems,
    activeProject,
    activeProjectTasks,
    activeProjectArchivedTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    draggingTask,
    isSheetOpen,
    sheetTask,
    scrimLocked,
    handleClientSelect,
    handleProjectSelect,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleCalendarDragStart,
    handleCalendarDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
    calendarDraggingTask,
    activeDropColumnId,
  } = useProjectsBoardState({ ...props, currentView: initialTab })

  const canLogTime = props.currentUserRole !== 'CLIENT'
  const addTimeLogDisabledReason = canLogTime
    ? null
    : 'Clients can review logged hours but cannot add new entries.'

  const activeProjectId = activeProject?.id ?? null
  const storageNamespace = props.currentUserId
    ? `projects-board-assigned-filter:${props.currentUserId}`
    : null
  const [isAcceptingDone, startAcceptingDone] = useTransition()
  const [isReviewActionPending, startReviewAction] = useTransition()
  const [pendingReviewAction, setPendingReviewAction] =
    useState<ReviewActionState | null>(null)

  const { onlyAssignedToMe, handleAssignedFilterChange } =
    useBoardAssignedFilter({
      activeProjectId,
      storageNamespace,
    })

  const { boardViewportRef, handleBoardScroll } = useBoardScrollPersistence({
    activeProjectId,
  })

  const {
    isTimeLogDialogOpen,
    timeLogProjectId,
    handleTimeLogDialogOpenChange,
    isViewTimeLogsOpen,
    viewTimeLogsProjectId,
    handleViewTimeLogsDialogOpenChange,
  } = useBoardTimeLogDialogs({ activeProject, canLogTime })

  const clientSlug =
    activeProject?.client?.slug ??
    (activeProject?.client_id
      ? (props.clients.find(client => client.id === activeProject.client_id)
          ?.slug ?? null)
      : null)

  const projectSlug = activeProject?.slug ?? null
  const projectPathBase =
    clientSlug && projectSlug ? `/projects/${clientSlug}/${projectSlug}` : null
  const boardHref = projectPathBase ? `${projectPathBase}/board` : '/projects'
  const calendarHref = projectPathBase
    ? `${projectPathBase}/calendar`
    : '/projects'
  const refineHref = projectPathBase ? `${projectPathBase}/refine` : '/projects'
  const activityHref = projectPathBase
    ? `${projectPathBase}/activity`
    : '/projects'
  const reviewHref = projectPathBase ? `${projectPathBase}/review` : '/projects'
  const calendarDisabled = !projectPathBase
  const refineDisabled = !projectPathBase
  const activityDisabled = !projectPathBase
  const reviewDisabled = !projectPathBase

  const renderAssignees = useMemo(
    () => createRenderAssignees(memberDirectory),
    [memberDirectory]
  )

  const calendarTaskSignature = useMemo(() => {
    if (!activeProject) {
      return null
    }

    const relevantTasks = activeProjectTasks
      .filter(
        task => task.due_on && !(task.status === 'DONE' && task.accepted_at)
      )
      .map(task =>
        [
          task.id,
          task.due_on ?? '',
          task.updated_at ?? '',
          task.status ?? '',
          task.accepted_at ?? '',
        ].join(':')
      )

    if (!relevantTasks.length) {
      return '__empty__'
    }

    relevantTasks.sort()
    return relevantTasks.join('|')
  }, [activeProject, activeProjectTasks])

  const previousCalendarSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeProject?.id) {
      previousCalendarSignatureRef.current = null
      return
    }

    if (calendarTaskSignature === null) {
      return
    }

    if (previousCalendarSignatureRef.current === calendarTaskSignature) {
      return
    }

    previousCalendarSignatureRef.current = calendarTaskSignature
    queryClient.invalidateQueries({
      queryKey: calendarTasksQueryRoot(activeProject.id),
    })
  }, [activeProject?.id, calendarTaskSignature, queryClient])

  const backlogGroups = useMemo(
    () => groupTasksByColumn(activeProjectTasks, BACKLOG_SECTIONS),
    [activeProjectTasks]
  )

  const onDeckTasks = backlogGroups.get('ON_DECK') ?? []
  const backlogTasks = backlogGroups.get('BACKLOG') ?? []
  const activeSheetTaskId = sheetTask?.id ?? null
  const tasksByColumnToRender = useMemo(() => {
    if (!onlyAssignedToMe || !props.currentUserId) {
      return tasksByColumn
    }

    return filterTasksByAssignee(tasksByColumn, props.currentUserId)
  }, [onlyAssignedToMe, props.currentUserId, tasksByColumn])

  const canAcceptTasks = props.currentUserRole === 'ADMIN'

  const acceptedTasks = useMemo(
    () =>
      activeProjectTasks.filter(
        task => task.status === 'DONE' && Boolean(task.accepted_at)
      ),
    [activeProjectTasks]
  )

  const archivedTasks = useMemo(
    () => activeProjectArchivedTasks,
    [activeProjectArchivedTasks]
  )

  const doneColumnTasks = tasksByColumnToRender.get('DONE') ?? []
  const hasAcceptableTasks = doneColumnTasks.length > 0
  const acceptAllDisabled = !canAcceptTasks || !hasAcceptableTasks
  const acceptAllDisabledReason = !canAcceptTasks
    ? 'Only administrators can accept tasks.'
    : !hasAcceptableTasks
      ? 'No tasks are ready for acceptance.'
      : null

  const reviewActionTaskId = pendingReviewAction?.taskId ?? null
  const reviewActionType = pendingReviewAction?.type ?? null
  const reviewActionDisabledReason = canAcceptTasks
    ? null
    : 'Only administrators can manage review tasks.'

  const handleAcceptAllDone = useCallback(() => {
    if (!activeProject) {
      return
    }

    if (!canAcceptTasks) {
      toast({
        variant: 'destructive',
        title: 'Action not allowed',
        description: 'Only administrators can accept tasks.',
      })
      return
    }

    startAcceptingDone(async () => {
      const result = await acceptDoneTasks({ projectId: activeProject.id })

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Unable to accept tasks',
          description: result.error,
        })
        return
      }

      if (result.acceptedCount > 0) {
        const plural = result.acceptedCount === 1 ? '' : 's'
        toast({
          title: 'Tasks accepted',
          description: `${result.acceptedCount} task${plural} moved out of Done.`,
        })
        return
      }

      toast({
        title: 'No tasks to accept',
        description: 'All tasks in Done are already accepted.',
      })
    })
  }, [activeProject, canAcceptTasks, startAcceptingDone, toast])

  const performReviewAction = useCallback(
    (
      type: ReviewActionKind,
      taskId: string,
      action: () => Promise<ActionResult>,
      success: { title: string; description?: string },
      errorTitle: string
    ) => {
      if (!canAcceptTasks) {
        toast({
          variant: 'destructive',
          title: 'Action not allowed',
          description: 'Only administrators can manage review tasks.',
        })
        return
      }

      if (
        pendingReviewAction &&
        pendingReviewAction.taskId === taskId &&
        pendingReviewAction.type === type
      ) {
        return
      }

      setPendingReviewAction({ type, taskId })
      startReviewAction(async () => {
        try {
          const result = await action()

          if (result.error) {
            toast({
              variant: 'destructive',
              title: errorTitle,
              description: result.error,
            })
            return
          }

          toast({
            title: success.title,
            description: success.description,
          })
        } catch (error) {
          console.error('Review action failed', error)
          toast({
            variant: 'destructive',
            title: errorTitle,
            description: 'An unexpected error occurred.',
          })
        } finally {
          setPendingReviewAction(null)
        }
      })
    },
    [canAcceptTasks, pendingReviewAction, startReviewAction, toast]
  )

  const handleAcceptTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'accept',
        taskId,
        () => acceptTask({ taskId }),
        {
          title: 'Task accepted',
          description: 'The task has been moved out of Done.',
        },
        'Unable to accept task'
      )
    },
    [performReviewAction]
  )

  const handleUnacceptTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'unaccept',
        taskId,
        () => unacceptTask({ taskId }),
        { title: 'Task reopened for client review.' },
        'Unable to unaccept task'
      )
    },
    [performReviewAction]
  )

  const handleRestoreTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'restore',
        taskId,
        () => restoreTask({ taskId }),
        {
          title: 'Task restored',
          description: 'The task has been returned to the project board.',
        },
        'Unable to restore task'
      )
    },
    [performReviewAction]
  )

  const handleDestroyTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'destroy',
        taskId,
        () => destroyTask({ taskId }),
        { title: 'Task permanently deleted' },
        'Unable to delete task'
      )
    },
    [performReviewAction]
  )

  const handleCreateTaskForDate = useCallback(
    (dueOn: string) => {
      openCreateSheet(undefined, { dueOn })
    },
    [openCreateSheet]
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
        <div className='flex justify-between'>
          <ProjectsBoardHeader
            clientItems={clientItems}
            projectItems={projectItems}
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            onClientChange={handleClientSelect}
            onProjectChange={handleProjectSelect}
          />
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6'>
            {activeProject ? (
              <ProjectBurndownWidget
                totalClientRemainingHours={
                  activeProject.burndown.totalClientRemainingHours
                }
                totalProjectLoggedHours={
                  activeProject.burndown.totalProjectLoggedHours
                }
                className='ml-auto w-full sm:w-auto'
                canLogTime={canLogTime}
                addTimeLogDisabledReason={addTimeLogDisabledReason}
                onViewTimeLogs={() => handleViewTimeLogsDialogOpenChange(true)}
                onAddTimeLog={() => handleTimeLogDialogOpenChange(true)}
              />
            ) : null}
          </div>
        </div>
      </AppShellHeader>
      <div className='flex h-full min-h-0 flex-col gap-4 sm:gap-6'>
        <ProjectsBoardTabs
          initialTab={initialTab}
          boardHref={boardHref}
          calendarHref={calendarHref}
          refineHref={refineHref}
          activityHref={activityHref}
          reviewHref={reviewHref}
          calendarDisabled={calendarDisabled}
          refineDisabled={refineDisabled}
          activityDisabled={activityDisabled}
          reviewDisabled={reviewDisabled}
          onlyAssignedToMe={onlyAssignedToMe}
          onAssignedFilterChange={handleAssignedFilterChange}
          feedback={feedback}
          activeProject={
            activeProject
              ? {
                  id: activeProject.id,
                  name: activeProject.name,
                  client: {
                    id: activeProject.client?.id ?? null,
                    name: activeProject.client?.name ?? null,
                  },
                  burndown: {
                    totalClientRemainingHours:
                      activeProject.burndown.totalClientRemainingHours,
                    totalProjectLoggedHours:
                      activeProject.burndown.totalProjectLoggedHours,
                  },
                }
              : null
          }
          canManageTasks={canManageTasks}
          renderAssignees={renderAssignees}
          tasksByColumn={tasksByColumnToRender}
          calendarProjectId={activeProject?.id ?? null}
          calendarAssignedUserId={props.currentUserId ?? null}
          onEditTask={handleEditTask}
          onCreateTask={openCreateSheet}
          onCreateTaskForDate={handleCreateTaskForDate}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onCalendarDragStart={handleCalendarDragStart}
          onCalendarDragEnd={handleCalendarDragEnd}
          draggingTask={draggingTask}
          calendarDraggingTask={calendarDraggingTask}
          scrimLocked={scrimLocked}
          isPending={isPending}
          boardViewportRef={boardViewportRef}
          onBoardScroll={handleBoardScroll}
          onDeckTasks={onDeckTasks}
          backlogTasks={backlogTasks}
          activeSheetTaskId={activeSheetTaskId}
          activityTargetClientId={activeProject?.client?.id ?? null}
          doneTasks={doneColumnTasks}
          acceptedTasks={acceptedTasks}
          archivedTasks={archivedTasks}
          onAcceptAllDone={handleAcceptAllDone}
          acceptAllDisabled={acceptAllDisabled}
          acceptAllDisabledReason={acceptAllDisabledReason}
          isAcceptingDone={isAcceptingDone}
          onAcceptTask={handleAcceptTask}
          onUnacceptTask={handleUnacceptTask}
          onRestoreTask={handleRestoreTask}
          onDestroyTask={handleDestroyTask}
          reviewActionTaskId={reviewActionTaskId}
          reviewActionType={reviewActionType}
          reviewActionDisabledReason={reviewActionDisabledReason}
          isReviewActionPending={isReviewActionPending}
          activeDropColumnId={activeDropColumnId}
        />
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
            defaultStatus={defaultTaskStatus}
            defaultDueOn={defaultTaskDueOn}
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
            clientId={activeProject.client?.id ?? null}
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

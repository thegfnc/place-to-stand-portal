'use client'

import { useCallback, useMemo } from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectTimeLogDialog } from './_components/project-time-log/project-time-log-dialog'
import { ProjectTimeLogHistoryDialog } from './_components/project-time-log-history-dialog'
import { ProjectsBoardTabs } from './_components/projects-board/projects-board-tabs'
import { TaskSheet } from './task-sheet'

import { createRenderAssignees } from '@/lib/projects/board/board-selectors'
import { useBoardAssignedFilter } from '@/lib/projects/board/state/use-board-assigned-filter'
import { useBoardScrollPersistence } from '@/lib/projects/board/state/use-board-scroll-persistence'
import { useBoardTimeLogDialogs } from '@/lib/projects/board/state/use-board-time-log-dialogs'
import { useProjectsBoardState } from '@/lib/projects/board/use-projects-board-state'
import { useToast } from '@/components/ui/use-toast'
import { useProjectsBoardDerivedState } from '@/lib/projects/board/state/use-projects-board-derived-state'
import { useProjectCalendarSync } from '@/lib/projects/calendar/use-project-calendar-sync'
import { useProjectsBoardReviewActions } from './_hooks/use-projects-board-review-actions'

type Props = Omit<Parameters<typeof useProjectsBoardState>[0], 'currentView'>
type ProjectsBoardProps = Props & {
  initialTab?: 'board' | 'calendar' | 'activity' | 'refine' | 'review'
}

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
    dropPreview,
    recentlyMovedTaskId,
  } = useProjectsBoardState({ ...props, currentView: initialTab })

  const canLogTime = props.currentUserRole !== 'CLIENT'
  const addTimeLogDisabledReason = canLogTime
    ? null
    : 'Clients can review logged hours but cannot add new entries.'

  const activeProjectId = activeProject?.id ?? null
  const storageNamespace = props.currentUserId
    ? `projects-board-assigned-filter:${props.currentUserId}`
    : null
  const canAcceptTasks = props.currentUserRole === 'ADMIN'

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
  useProjectCalendarSync({
    activeProjectId,
    tasks: activeProjectTasks,
  })

  const {
    onDeckTasks,
    backlogTasks,
    tasksByColumnToRender,
    acceptedTasks,
    archivedTasks,
    doneColumnTasks,
    acceptAllDisabled,
    acceptAllDisabledReason,
  } = useProjectsBoardDerivedState({
    activeProjectTasks,
    activeProjectArchivedTasks,
    tasksByColumn,
    onlyAssignedToMe,
    currentUserId: props.currentUserId ?? null,
    canAcceptTasks,
  })

  const {
    handleAcceptAllDone,
    handleAcceptTask,
    handleUnacceptTask,
    handleRestoreTask,
    handleDestroyTask,
    isAcceptingDone,
    isReviewActionPending,
    pendingReviewAction,
  } = useProjectsBoardReviewActions({
    canAcceptTasks,
    activeProjectId,
    toast,
  })

  const activeSheetTaskId = sheetTask?.id ?? null

  const reviewActionTaskId = pendingReviewAction?.taskId ?? null
  const reviewActionType = pendingReviewAction?.type ?? null
  const reviewActionDisabledReason = canAcceptTasks
    ? null
    : 'Only administrators can manage review tasks.'

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
          dropPreview={dropPreview}
          recentlyMovedTaskId={recentlyMovedTaskId}
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

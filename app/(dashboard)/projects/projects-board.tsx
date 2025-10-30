'use client'

import Link from 'next/link'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEventHandler,
} from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppShellHeader } from '@/components/layout/app-shell'
import type { TaskWithRelations } from '@/lib/types'
import {
  BACKLOG_SECTIONS,
  BOARD_COLUMNS,
} from '@/lib/projects/board/board-constants'
import { groupTasksByColumn } from '@/lib/projects/board/board-utils'
import { useProjectsBoardState } from '@/lib/projects/board/use-projects-board-state'

import { KanbanColumn } from './_components/kanban-column'
import { BacklogSection } from './_components/backlog-section'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { TaskDragOverlay } from './_components/task-drag-overlay'
import { TaskSheet } from './task-sheet'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectTimeLogDialog } from './_components/project-time-log-dialog'
import { ProjectTimeLogHistoryDialog } from './_components/project-time-log-history-dialog'

type Props = Omit<Parameters<typeof useProjectsBoardState>[0], 'currentView'>
type ProjectsBoardProps = Props & {
  initialTab?: 'board' | 'activity' | 'backlog'
}

const NO_PROJECTS_TITLE = 'No projects assigned yet'
const NO_PROJECTS_DESCRIPTION =
  'Once an administrator links you to a project, the workspace will unlock here.'
const NO_SELECTION_TITLE = 'No project selected'
const NO_SELECTION_DESCRIPTION =
  'Choose a client and project above to view the associated tasks.'

export function ProjectsBoard({
  initialTab = 'board',
  ...props
}: ProjectsBoardProps) {
  const currentView = initialTab
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
    defaultTaskStatus,
  } = useProjectsBoardState({ ...props, currentView })

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
  const [assignedFilterMap, setAssignedFilterMap] = useState<
    Record<string, boolean>
  >({})
  const activeProjectId = activeProject?.id ?? null
  const storageNamespace = props.currentUserId
    ? `projects-board-assigned-filter:${props.currentUserId}`
    : null
  const bootstrappedNamespaceRef = useRef<string | null>(null)
  const hasBootstrappedAssignedFiltersRef = useRef(false)
  const onlyAssignedToMe = activeProjectId
    ? (assignedFilterMap[activeProjectId] ?? false)
    : false
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
  const backlogHref = projectPathBase
    ? `${projectPathBase}/backlog`
    : '/projects'
  const activityHref = projectPathBase
    ? `${projectPathBase}/activity`
    : '/projects'
  const backlogDisabled = !projectPathBase
  const activityDisabled = !projectPathBase

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
    [activeProject, canLogTime, setIsTimeLogDialogOpen, setTimeLogProjectId]
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
    [activeProject, setIsViewTimeLogsOpen, setViewTimeLogsProjectId]
  )

  const boardViewportRef = useRef<HTMLDivElement | null>(null)

  const boardScrollKey = useMemo(() => {
    if (!activeProjectId) return null
    return `projects-board-scroll:${activeProjectId}`
  }, [activeProjectId])

  const handleAssignedFilterChange = useCallback(
    (value: boolean) => {
      if (!activeProjectId) {
        return
      }

      setAssignedFilterMap(prev => {
        if (value) {
          if (prev[activeProjectId]) {
            return prev
          }

          return { ...prev, [activeProjectId]: true }
        }

        if (!prev[activeProjectId]) {
          return prev
        }

        const next = { ...prev }
        delete next[activeProjectId]
        return next
      })
    },
    [activeProjectId, setAssignedFilterMap]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!storageNamespace) {
      hasBootstrappedAssignedFiltersRef.current = false
      bootstrappedNamespaceRef.current = null

      startTransition(() => {
        setAssignedFilterMap(current => {
          hasBootstrappedAssignedFiltersRef.current = true
          return Object.keys(current).length ? {} : current
        })
      })

      return
    }

    if (bootstrappedNamespaceRef.current === storageNamespace) {
      return
    }

    hasBootstrappedAssignedFiltersRef.current = false
    bootstrappedNamespaceRef.current = storageNamespace

    let nextMap: Record<string, boolean> = {}

    try {
      const raw = window.sessionStorage.getItem(storageNamespace)

      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        nextMap = Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
          )
        )
      }
    } catch {
      nextMap = {}
    }

    const nextEntries = Object.entries(nextMap)

    startTransition(() => {
      setAssignedFilterMap(current => {
        const currentEntries = Object.entries(current)

        if (currentEntries.length === nextEntries.length) {
          const hasDifference = nextEntries.some(
            ([key, value]) => current[key] !== value
          )

          if (!hasDifference) {
            hasBootstrappedAssignedFiltersRef.current = true
            return current
          }
        }

        if (!nextEntries.length && !currentEntries.length) {
          hasBootstrappedAssignedFiltersRef.current = true
          return current
        }

        hasBootstrappedAssignedFiltersRef.current = true
        return nextMap
      })
    })
  }, [storageNamespace])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !storageNamespace ||
      !hasBootstrappedAssignedFiltersRef.current
    ) {
      return
    }

    try {
      if (Object.keys(assignedFilterMap).length === 0) {
        window.sessionStorage.removeItem(storageNamespace)
        return
      }

      window.sessionStorage.setItem(
        storageNamespace,
        JSON.stringify(assignedFilterMap)
      )
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }, [assignedFilterMap, storageNamespace])

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

  const backlogGroups = useMemo(
    () => groupTasksByColumn(activeProjectTasks, BACKLOG_SECTIONS),
    [activeProjectTasks]
  )

  const onDeckTasks = backlogGroups.get('ON_DECK') ?? []
  const backlogTasks = backlogGroups.get('BACKLOG') ?? []
  const activeSheetTaskId = sheetTask?.id ?? null
  const tasksByColumnToRender = useMemo(() => {
    if (!onlyAssignedToMe) {
      return tasksByColumn
    }

    const filtered = new Map<string, TaskWithRelations[]>()

    tasksByColumn.forEach((columnTasks, columnId) => {
      filtered.set(
        columnId,
        columnTasks.filter(task =>
          task.assignees.some(
            assignee => assignee.user_id === props.currentUserId
          )
        )
      )
    })

    return filtered
  }, [onlyAssignedToMe, props.currentUserId, tasksByColumn])

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
        <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
              <TabsTrigger
                value='board'
                className='px-3 py-1.5 text-sm'
                asChild
              >
                <Link href={boardHref} prefetch={false}>
                  Board
                </Link>
              </TabsTrigger>
              <TabsTrigger
                value='backlog'
                className='px-3 py-1.5 text-sm'
                asChild
                disabled={backlogDisabled}
              >
                <Link
                  href={backlogHref}
                  prefetch={false}
                  aria-disabled={backlogDisabled}
                  tabIndex={backlogDisabled ? -1 : undefined}
                  onClick={event => {
                    if (backlogDisabled) {
                      event.preventDefault()
                    }
                  }}
                  className={
                    backlogDisabled
                      ? 'pointer-events-none opacity-50'
                      : undefined
                  }
                >
                  Backlog
                </Link>
              </TabsTrigger>
              <TabsTrigger
                value='activity'
                className='px-3 py-1.5 text-sm'
                asChild
                disabled={activityDisabled}
              >
                <Link
                  href={activityHref}
                  prefetch={false}
                  aria-disabled={activityDisabled}
                  tabIndex={activityDisabled ? -1 : undefined}
                  onClick={event => {
                    if (activityDisabled) {
                      event.preventDefault()
                    }
                  }}
                  className={
                    activityDisabled
                      ? 'pointer-events-none opacity-50'
                      : undefined
                  }
                >
                  Activity
                </Link>
              </TabsTrigger>
            </TabsList>
            {initialTab === 'board' ? (
              <div className='bg-background/80 flex w-full justify-end rounded-md border p-2 sm:w-auto'>
                <Label
                  htmlFor='projects-board-assigned-filter'
                  className='text-muted-foreground cursor-pointer'
                >
                  <Checkbox
                    id='projects-board-assigned-filter'
                    checked={onlyAssignedToMe}
                    onCheckedChange={value =>
                      handleAssignedFilterChange(value === true)
                    }
                    className='h-4 w-4'
                  />
                  <span>Only show tasks assigned to me</span>
                </Label>
              </div>
            ) : null}
          </div>
          {initialTab === 'board' ? (
            <TabsContent
              value='board'
              className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
            >
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
                              tasks={tasksByColumnToRender.get(column.id) ?? []}
                              renderAssignees={renderAssignees}
                              onEditTask={handleEditTask}
                              canManage={canManageTasks}
                              activeTaskId={activeSheetTaskId}
                              onCreateTask={openCreateSheet}
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
            </TabsContent>
          ) : null}
          {initialTab === 'backlog' ? (
            <TabsContent
              value='backlog'
              className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
            >
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
                  <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div className='flex min-h-0 flex-1 flex-col gap-4'>
                      <BacklogSection
                        status='ON_DECK'
                        label='On Deck'
                        tasks={onDeckTasks}
                        canManage={canManageTasks}
                        renderAssignees={renderAssignees}
                        onEditTask={handleEditTask}
                        activeTaskId={activeSheetTaskId}
                        onCreateTask={openCreateSheet}
                      />
                      <BacklogSection
                        status='BACKLOG'
                        label='Backlog'
                        tasks={backlogTasks}
                        canManage={canManageTasks}
                        renderAssignees={renderAssignees}
                        onEditTask={handleEditTask}
                        activeTaskId={activeSheetTaskId}
                        onCreateTask={openCreateSheet}
                      />
                    </div>
                    <TaskDragOverlay
                      draggingTask={draggingTask}
                      renderAssignees={renderAssignees}
                    />
                  </DndContext>
                  {isPending && !scrimLocked ? (
                    <div className='bg-background/60 pointer-events-none absolute inset-0 flex items-center justify-center'>
                      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                    </div>
                  ) : null}
                </div>
              )}
            </TabsContent>
          ) : null}
          {initialTab === 'activity' ? (
            <TabsContent
              value='activity'
              className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
            >
              {!activeProject ? (
                <ProjectsBoardEmpty
                  title={NO_SELECTION_TITLE}
                  description={NO_SELECTION_DESCRIPTION}
                />
              ) : (
                <section className='bg-background rounded-xl border p-6 shadow-sm'>
                  <div className='space-y-1'>
                    <h3 className='text-lg font-semibold'>Project activity</h3>
                    <p className='text-muted-foreground text-sm'>
                      Review task updates, comments, and assignments for this
                      project.
                    </p>
                  </div>
                  <div className='mt-3'>
                    <ActivityFeed
                      targetType={['PROJECT', 'TASK']}
                      projectId={activeProject.id}
                      clientId={activeProject.client?.id ?? null}
                      emptyState='No project activity yet.'
                    />
                  </div>
                </section>
              )}
            </TabsContent>
          ) : null}
        </Tabs>
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

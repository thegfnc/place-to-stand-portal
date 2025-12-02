'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { AppUser } from '@/lib/auth/session'
import type {
  DbUser,
  ProjectTypeValue,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { createRenderAssignees } from '@/lib/projects/board/board-selectors'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import { ProjectsBoardEmpty } from '@/app/(dashboard)/projects/_components/projects-board-empty'
import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'
import { useMyTasksReorderMutation } from '@/lib/projects/tasks/use-my-tasks-data'
import type { MyTaskStatus } from '@/lib/projects/tasks/my-tasks-constants'

import { MyTasksBoard } from './my-tasks-board'
import type { MyTasksBoardReorderUpdate, TaskLookup } from './my-tasks-board'
import { MyTasksCalendar } from './my-tasks-calendar'
import { Plus } from 'lucide-react'

export type MyTasksInitialEntry = {
  taskId: string
  projectId: string
  sortOrder: number | null
}

export type MyTasksView = 'board' | 'calendar'

type MyTasksPageProps = {
  user: AppUser
  admins: DbUser[]
  projects: ProjectWithRelations[]
  projectSelectionProjects: ProjectWithRelations[]
  initialEntries: MyTasksInitialEntry[]
  activeTaskId: string | null
  view: MyTasksView
}

export function MyTasksPage({
  user,
  admins,
  projects,
  projectSelectionProjects,
  initialEntries,
  activeTaskId,
  view,
}: MyTasksPageProps) {
  const router = useRouter()
  const reorderMutation = useMyTasksReorderMutation()
  const [isSheetOpen, setIsSheetOpen] = useState(Boolean(activeTaskId))
  const [createTaskContext, setCreateTaskContext] = useState<
    | { status: MyTaskStatus; assigneeId: string; projectId: string | null }
    | null
  >(null)
  const [, startRefresh] = useTransition()
  const boardScrollStorageKey = useMemo(
    () => `my-tasks-board:${user.id}`,
    [user.id]
  )
  const calendarScrollStorageKey = useMemo(
    () => `my-tasks-calendar:${user.id}`,
    [user.id]
  )

  const taskLookup = useMemo(() => buildTaskLookup(projects), [projects])
  const sanitizedEntries = useMemo(
    () => initialEntries.filter(entry => taskLookup.has(entry.taskId)),
    [initialEntries, taskLookup]
  )

  const [entries, setEntries] =
    useState<MyTasksInitialEntry[]>(sanitizedEntries)

  useEffect(() => {
    setEntries(sanitizedEntries)
  }, [sanitizedEntries])

  useEffect(() => {
    if (createTaskContext) {
      return
    }
    setIsSheetOpen(Boolean(activeTaskId))
  }, [activeTaskId, createTaskContext])

  const memberDirectory = useMemo(
    () => buildMemberDirectory(projects, admins),
    [projects, admins]
  )
  const renderAssignees = useMemo(
    () => createRenderAssignees(memberDirectory),
    [memberDirectory]
  )

  const taskContexts = useMemo(
    () => buildTaskContextLookup(taskLookup),
    [taskLookup]
  )

  const handleDueDateChange = useCallback(
    (taskId: string, dueOn: string | null) => {
      const lookup = taskLookup.get(taskId)

      if (!lookup) {
        return
      }

      lookup.task.due_on = dueOn
      setEntries(current => [...current])
    },
    [taskLookup]
  )

  const getTaskCardOptions = useCallback(
    (task: TaskWithRelations) => ({
      context: taskContexts.get(task.id),
      hideAssignees: true,
    }),
    [taskContexts]
  )

  const description =
    user.role === 'CLIENT'
      ? 'All tasks currently assigned to you across every client and project.'
      : 'Every task across the portfolio that currently needs your attention.'

  const activeTaskMeta = activeTaskId
    ? (taskLookup.get(activeTaskId) ?? null)
    : null
  const editingTaskMeta = createTaskContext ? null : activeTaskMeta
  const shouldKeepTaskSheetMounted = Boolean(
    editingTaskMeta || createTaskContext || isSheetOpen
  )
  const [shouldRenderTaskSheet, setShouldRenderTaskSheet] = useState(
    shouldKeepTaskSheetMounted
  )

  useEffect(() => {
    if (shouldKeepTaskSheetMounted) {
      setShouldRenderTaskSheet(true)
      return
    }

    const timeout = setTimeout(() => {
      setShouldRenderTaskSheet(false)
    }, 300)

    return () => {
      clearTimeout(timeout)
    }
  }, [shouldKeepTaskSheetMounted])

  const buildViewPath = useCallback(
    (targetView: MyTasksView, taskId?: string | null) => {
      const suffix = taskId ? `/${taskId}` : ''
      return `/my-tasks/${targetView}${suffix}`
    },
    []
  )

  const handleOpenTask = useCallback(
    (taskId: string) => {
      router.push(buildViewPath(view, taskId), { scroll: false })
    },
    [buildViewPath, router, view]
  )

  const handleSheetChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsSheetOpen(false)
        if (createTaskContext) {
          setCreateTaskContext(null)
          startRefresh(() => {
            router.refresh()
          })
          return
        }
        router.push(buildViewPath(view), { scroll: false })
        startRefresh(() => {
          router.refresh()
        })
        return
      }

      setIsSheetOpen(true)
    },
    [buildViewPath, createTaskContext, router, startRefresh, view]
  )

  const handleReorder = useCallback(
    async (update: MyTasksBoardReorderUpdate) => {
      setEntries(update.nextEntries)

      try {
        await reorderMutation.mutateAsync(update.payload)
      } catch {
        setEntries(update.previousEntries)
      }
    },
    [reorderMutation]
  )

  const canManageTasks = user.role === 'ADMIN'
  const totalTaskCount = entries.length
  const creationDisabledReason = canManageTasks
    ? null
    : 'Admin access is required to create tasks.'

  const handleStartCreateTask = useCallback(
    (status: MyTaskStatus = 'ON_DECK') => {
      if (!canManageTasks) {
        return
      }

      setCreateTaskContext({
        status,
        assigneeId: user.id,
        projectId: null,
      })
      setIsSheetOpen(true)
    },
    [canManageTasks, user.id]
  )

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>My Tasks</h1>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>
      </AppShellHeader>
      <Tabs value={view} className='flex min-h-0 flex-1 flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
            <TabsTrigger value='board' className='px-3 py-1.5 text-sm' asChild>
              <Link href={buildViewPath('board', activeTaskId)} prefetch>
                Board
              </Link>
            </TabsTrigger>
            <TabsTrigger
              value='calendar'
              className='px-3 py-1.5 text-sm'
              asChild
            >
              <Link href={buildViewPath('calendar', activeTaskId)} prefetch>
                Calendar
              </Link>
            </TabsTrigger>
          </TabsList>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm'>
              Total tasks: {totalTaskCount}
            </span>
            <DisabledFieldTooltip
              disabled={!canManageTasks}
              reason={creationDisabledReason}
            >
              <Button
                type='button'
                size='sm'
                onClick={() => handleStartCreateTask('ON_DECK')}
                disabled={!canManageTasks}
              >
                <Plus className='h-4 w-4' />
                Add task
              </Button>
            </DisabledFieldTooltip>
          </div>
        </div>
        <TabsContent
          value='board'
          className='mt-0 flex min-h-0 flex-1 flex-col gap-4 focus-visible:outline-none sm:gap-6'
        >
          {entries.length === 0 ? (
            <ProjectsBoardEmpty
              title='No tasks assigned'
              description='Once a task is assigned to you, it will appear here.'
            />
          ) : (
            <MyTasksBoard
              entries={entries}
              taskLookup={taskLookup}
              renderAssignees={renderAssignees}
              getTaskCardOptions={getTaskCardOptions}
              onOpenTask={handleOpenTask}
              onReorder={handleReorder}
              isPending={reorderMutation.isPending}
              activeTaskId={activeTaskId}
              scrollStorageKey={boardScrollStorageKey}
              onCreateTask={handleStartCreateTask}
              canCreateTasks={canManageTasks}
            />
          )}
        </TabsContent>
        <TabsContent
          value='calendar'
          className='mt-0 flex min-h-0 flex-1 flex-col gap-4 focus-visible:outline-none sm:gap-6'
        >
          <MyTasksCalendar
            entries={entries}
            taskLookup={taskLookup}
            renderAssignees={renderAssignees}
            onOpenTask={handleOpenTask}
            activeTaskId={activeTaskId}
            onDueDateChange={handleDueDateChange}
            scrollStorageKey={calendarScrollStorageKey}
          />
        </TabsContent>
      </Tabs>
      {shouldRenderTaskSheet ? (
        <TaskSheet
          open={isSheetOpen}
          onOpenChange={handleSheetChange}
          task={editingTaskMeta?.task}
          canManage={canManageTasks}
          admins={admins}
          currentUserId={user.id}
          currentUserRole={user.role}
          defaultStatus={createTaskContext?.status ?? 'ON_DECK'}
          defaultDueOn={null}
          projects={projects}
          projectSelectionProjects={projectSelectionProjects}
          defaultProjectId={
            createTaskContext?.projectId ?? editingTaskMeta?.project.id ?? null
          }
          defaultAssigneeId={createTaskContext?.assigneeId ?? null}
        />
      ) : null}
    </div>
  )
}

type TaskContextMeta = {
  clientLabel: string
  clientHref: string | null
  projectLabel: string
  projectHref: string | null
  layout: 'inline' | 'stacked'
  projectType: ProjectTypeValue
}

function buildTaskLookup(projects: ProjectWithRelations[]): TaskLookup {
  const map: TaskLookup = new Map()

  projects.forEach(project => {
    project.tasks.forEach(task => {
      map.set(task.id, { task, project })
    })
  })

  return map
}

function buildMemberDirectory(
  projects: ProjectWithRelations[],
  admins: DbUser[]
) {
  const directory = new Map<string, { name: string }>()

  projects.forEach(project => {
    project.members.forEach(member => {
      const user = member.user
      const name =
        user.full_name?.trim() ||
        user.email?.split('@')[0] ||
        'Unassigned member'
      directory.set(user.id, { name })
    })
  })

  admins.forEach(admin => {
    const name =
      admin.full_name?.trim() || admin.email?.split('@')[0] || 'Administrator'
    directory.set(admin.id, { name })
  })

  return directory
}

function buildTaskContextLookup(
  lookup: TaskLookup
): Map<string, TaskContextMeta> {
  const map = new Map<string, TaskContextMeta>()

  lookup.forEach(({ project }, taskId) => {
    const clientLabel = resolveClientLabel(project)
    const clientHref = buildClientHref(project)
    const projectHref = buildProjectHref(project)

    map.set(taskId, {
      clientLabel,
      clientHref,
      projectLabel: project.name,
      projectHref,
      layout: 'stacked',
      projectType: project.type,
    })
  })

  return map
}

function resolveClientLabel(project: ProjectWithRelations): string {
  if (project.client?.name) {
    return project.client.name
  }

  if (project.type === 'PERSONAL') {
    return 'Personal'
  }

  if (project.type === 'INTERNAL') {
    return 'Internal'
  }

  return 'Unassigned'
}

function buildClientHref(project: ProjectWithRelations): string | null {
  // Only link to client pages for CLIENT-type projects with a valid client
  if (project.type !== 'CLIENT' || !project.client) {
    return null
  }

  const clientSlug = project.client.slug
  if (clientSlug) {
    return `/clients/${clientSlug}`
  }

  return `/clients/${project.client.id}`
}

function buildProjectHref(project: ProjectWithRelations): string | null {
  if (!project.slug) {
    return null
  }

  if (project.type === 'INTERNAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${project.slug}/board`
  }

  if (project.type === 'PERSONAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${project.slug}/board`
  }

  const clientSlug = project.client?.slug ?? null

  if (!clientSlug) {
    return null
  }

  return `/projects/${clientSlug}/${project.slug}/board`
}

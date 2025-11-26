'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

import { MyTasksBoard } from './my-tasks-board'
import type { MyTasksBoardReorderUpdate, TaskLookup } from './my-tasks-board'
import { MyTasksCalendar } from './my-tasks-calendar'

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
  initialEntries: MyTasksInitialEntry[]
  activeTaskId: string | null
  view: MyTasksView
}

export function MyTasksPage({
  user,
  admins,
  projects,
  initialEntries,
  activeTaskId,
  view,
}: MyTasksPageProps) {
  const router = useRouter()
  const [currentView, setCurrentView] = useState<MyTasksView>(view)
  const reorderMutation = useMyTasksReorderMutation()
  const [isSheetOpen, setIsSheetOpen] = useState(Boolean(activeTaskId))
  const [, startRefresh] = useTransition()

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
    setIsSheetOpen(Boolean(activeTaskId))
  }, [activeTaskId])

  useEffect(() => {
    setCurrentView(view)
  }, [view])

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

  const buildViewPath = useCallback(
    (targetView: MyTasksView, taskId?: string | null) => {
      const suffix = taskId ? `/${taskId}` : ''
      return `/my-tasks/${targetView}${suffix}`
    },
    []
  )

  const handleTabChange = useCallback(
    (nextValue: string) => {
      const nextView = nextValue as MyTasksView
      setCurrentView(nextView)
      router.push(buildViewPath(nextView, activeTaskId), { scroll: false })
    },
    [activeTaskId, buildViewPath, router]
  )

  const handleOpenTask = useCallback(
    (taskId: string) => {
      router.push(buildViewPath(currentView, taskId), { scroll: false })
    },
    [buildViewPath, currentView, router]
  )

  const handleSheetChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsSheetOpen(false)
        router.push(buildViewPath(currentView), { scroll: false })
        startRefresh(() => {
          router.refresh()
        })
        return
      }

      setIsSheetOpen(true)
    },
    [buildViewPath, currentView, router, startRefresh]
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

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>My Tasks</h1>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>
      </AppShellHeader>
      <Tabs
        value={currentView}
        onValueChange={handleTabChange}
        className='flex min-h-0 flex-1 flex-col gap-3'
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
            <TabsTrigger value='board' className='px-3 py-1.5 text-sm'>
              Board
            </TabsTrigger>
            <TabsTrigger value='calendar' className='px-3 py-1.5 text-sm'>
              Calendar
            </TabsTrigger>
          </TabsList>
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
          />
        </TabsContent>
      </Tabs>
      {activeTaskMeta ? (
        <TaskSheet
          open={isSheetOpen}
          onOpenChange={handleSheetChange}
          project={activeTaskMeta.project}
          task={activeTaskMeta.task}
          canManage={canManageTasks}
          admins={admins}
          currentUserId={user.id}
          currentUserRole={user.role}
          defaultStatus='ON_DECK'
          defaultDueOn={null}
        />
      ) : null}
    </div>
  )
}

type TaskContextMeta = {
  clientLabel: string
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
    const projectHref = buildProjectHref(project)

    map.set(taskId, {
      clientLabel,
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

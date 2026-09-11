'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { Button } from '@pts/ui/button'
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
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'
import {
  DONE_WINDOW_WEEKS,
  MAX_DONE_WEEKS,
} from '@/lib/projects/tasks/done-window'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

import { MyTasksBoard } from './my-tasks-board'
import type { MyTasksBoardReorderUpdate, TaskLookup } from './my-tasks-board'
import { MyTasksCalendar } from './my-tasks-calendar'
import { PersonSelector } from './person-selector'
import {
  ClientSelector,
  type ClientSelectorOption,
} from './client-selector'
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
  /** An admin id, or `'all'` for the everyone view. */
  selectedAssigneeId: string
  /** A client id, or `'all'` when unscoped. */
  selectedClientId: string
  /** Project types withheld from the board (`?hide=`); empty = show all. */
  hiddenProjectTypes: ProjectTypeValue[]
  clients: ClientSelectorOption[]
  /** Server-rendered instant the board's Done window measures back from. */
  now: string
  /** Assigned DONE tasks completed before the first window. */
  initialOlderDoneCount: number
}

export function MyTasksPage({
  user,
  admins,
  projects,
  projectSelectionProjects,
  initialEntries,
  activeTaskId,
  view,
  selectedAssigneeId,
  selectedClientId,
  hiddenProjectTypes,
  clients,
  now,
  initialOlderDoneCount,
}: MyTasksPageProps) {
  const router = useRouter()
  const reorderMutation = useMyTasksReorderMutation()
  // Sheet selection goes through the shared hook like every other entity
  // sheet: the URL stays the source of truth, mirrored in local state so open
  // and close land immediately instead of waiting on the route transition.
  // `selectedValue` is the raw `?task=` value — the server prop is
  // uuid-guarded, so `new` only shows up here.
  const {
    selectedValue: taskParam,
    selectedId: selectedTaskId,
    isCreating: isCreatingTask,
    isOpen: isSheetOpen,
    select: selectTask,
    openCreate: openCreateTask,
    clear: clearTask,
  } = useSheetParamSelection('task')
  const [createTaskContext, setCreateTaskContext] = useState<{
    status: MyTaskStatus
    assigneeId: string
    projectId: string | null
  } | null>(null)
  const [, startRefresh] = useTransition()
  const boardScrollStorageKey = useMemo(
    () => `my-tasks-board:${user.id}`,
    [user.id]
  )
  const calendarScrollStorageKey = useMemo(
    () => `my-tasks-calendar:${user.id}`,
    [user.id]
  )

  // Done-window paging state. The board opens on one window and fetches
  // older slices on demand, so the first paint never carries the whole
  // completed archive.
  const [doneWeeks, setDoneWeeks] = useState(DONE_WINDOW_WEEKS)
  const [olderDoneCount, setOlderDoneCount] = useState(initialOlderDoneCount)
  const [olderEntries, setOlderEntries] = useState<MyTasksInitialEntry[]>([])
  const [olderProjects, setOlderProjects] = useState<ProjectWithRelations[]>([])
  const [isLoadingOlderDone, setIsLoadingOlderDone] = useState(false)
  const [doneWindowError, setDoneWindowError] = useState<string | null>(null)
  // Pinned at mount. `now` changes on every server render, and stepping the
  // window against a moving anchor would leave slivers of time between one
  // slice's start and the next slice's end.
  const [windowAnchor] = useState(now)

  // Widening pulls in projects the initial load never hydrated; they extend
  // the server's set rather than replacing it.
  const allProjects = useMemo(() => {
    if (!olderProjects.length) {
      return projects
    }

    const known = new Set(projects.map(project => project.id))
    return [...projects, ...olderProjects.filter(p => !known.has(p.id))]
  }, [projects, olderProjects])

  const taskLookup = useMemo(() => buildTaskLookup(allProjects), [allProjects])
  // Deliberately keyed off the server's projects, not `allProjects`: this only
  // filters the server's own entries, and rebuilding it every time a slice
  // lands would reset `entries` and discard in-flight reorder state.
  const serverTaskLookup = useMemo(() => buildTaskLookup(projects), [projects])
  const sanitizedEntries = useMemo(
    () => initialEntries.filter(entry => serverTaskLookup.has(entry.taskId)),
    [initialEntries, serverTaskLookup]
  )

  const [entries, setEntries] =
    useState<MyTasksInitialEntry[]>(sanitizedEntries)

  // Reset local copies when their inputs change, using the
  // adjust-state-during-render pattern instead of resync effects.
  const [prevSanitizedEntries, setPrevSanitizedEntries] =
    useState(sanitizedEntries)
  if (prevSanitizedEntries !== sanitizedEntries) {
    setPrevSanitizedEntries(sanitizedEntries)
    setEntries(sanitizedEntries)
  }

  // Switching whose board you're viewing — or which projects it scopes to —
  // is a different Done history; carrying the previous scope's loaded slices
  // over would keep showing tasks the new scope excludes.
  const scopeKey = [
    selectedAssigneeId,
    selectedClientId,
    hiddenProjectTypes.join(','),
  ].join('|')
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey)
  if (prevScopeKey !== scopeKey) {
    setPrevScopeKey(scopeKey)
    setDoneWeeks(DONE_WINDOW_WEEKS)
    setOlderDoneCount(initialOlderDoneCount)
    setOlderEntries([])
    setOlderProjects([])
    setDoneWindowError(null)
  }

  // Slices append below the server's entries; dedupe by task id so a task that
  // drifts into the initial window between loads can't render twice.
  const boardEntries = useMemo(() => {
    if (!olderEntries.length) {
      return entries
    }

    const seen = new Set(entries.map(entry => entry.taskId))
    return [
      ...entries,
      ...olderEntries.filter(
        entry => !seen.has(entry.taskId) && taskLookup.has(entry.taskId)
      ),
    ]
  }, [entries, olderEntries, taskLookup])

  const handleLoadOlderDone = useCallback(async () => {
    if (isLoadingOlderDone) {
      return
    }

    const toWeeks = Math.min(doneWeeks + DONE_WINDOW_WEEKS, MAX_DONE_WEEKS)

    if (toWeeks <= doneWeeks) {
      return
    }

    setIsLoadingOlderDone(true)
    setDoneWindowError(null)

    try {
      const response = await fetch('/api/my-tasks/done-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 'all' is a UI sentinel; the API takes it verbatim and widens
          // to every assignee. The client scope rides along so the wider
          // window matches what the board is showing.
          assigneeId: selectedAssigneeId,
          clientId: selectedClientId === 'all' ? null : selectedClientId,
          hiddenProjectTypes,
          fromWeeks: doneWeeks,
          toWeeks,
          now: windowAnchor,
        }),
        cache: 'no-store',
      })

      const payload = (await response.json()) as {
        ok: boolean
        data?: {
          entries: MyTasksInitialEntry[]
          projects: ProjectWithRelations[]
          olderDoneCount: number
        }
        error?: string
      }

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? 'Request failed')
      }

      const data = payload.data

      setOlderProjects(current => {
        const known = new Set(current.map(project => project.id))
        return [...current, ...data.projects.filter(p => !known.has(p.id))]
      })
      setOlderEntries(current => {
        const seen = new Set(current.map(entry => entry.taskId))
        return [
          ...current,
          ...data.entries.filter(entry => !seen.has(entry.taskId)),
        ]
      })
      setOlderDoneCount(data.olderDoneCount)
      setDoneWeeks(toWeeks)
    } catch (error) {
      console.error('Failed to load older done tasks', error)
      setDoneWindowError('Unable to load older tasks. Please try again.')
    } finally {
      setIsLoadingOlderDone(false)
    }
  }, [
    doneWeeks,
    hiddenProjectTypes,
    isLoadingOlderDone,
    selectedAssigneeId,
    selectedClientId,
    windowAnchor,
  ])

  // Drop the create seed defaults once the create sheet's param is gone.
  const [prevTaskParam, setPrevTaskParam] = useState(taskParam)
  if (prevTaskParam !== taskParam) {
    setPrevTaskParam(taskParam)
    if (taskParam !== NEW_SHEET_VALUE) {
      setCreateTaskContext(null)
    }
  }

  const memberDirectory = useMemo(
    () => buildMemberDirectory(allProjects, admins),
    [allProjects, admins]
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

  const handleCalendarRefresh = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router, startRefresh])

  const getTaskCardOptions = useCallback(
    (task: TaskWithRelations) => ({
      context: taskContexts.get(task.id),
    }),
    [taskContexts]
  )


  // Resolve from the LOCAL selection, not the server's `activeTaskId`. The
  // board already holds every loaded task client-side, so this lands in the
  // same render as the open — whereas `activeTaskId` only updates when the
  // route transition commits, which opened the sheet on an empty form and
  // filled it ~230ms later, after the slide-in had finished.
  const resolvedTaskId = selectedTaskId ?? activeTaskId
  const activeTaskMeta = resolvedTaskId
    ? (taskLookup.get(resolvedTaskId) ?? null)
    : null
  const editingTaskMeta = isCreatingTask ? null : activeTaskMeta
  const shouldKeepTaskSheetMounted = Boolean(
    editingTaskMeta || createTaskContext || isSheetOpen
  )
  const [shouldRenderTaskSheet, setShouldRenderTaskSheet] = useState(
    shouldKeepTaskSheetMounted
  )

  // Mounting happens immediately (adjusted during render); the effect only
  // handles the delayed unmount that lets the close animation finish.
  if (shouldKeepTaskSheetMounted && !shouldRenderTaskSheet) {
    setShouldRenderTaskSheet(true)
  }

  useEffect(() => {
    if (shouldKeepTaskSheetMounted) {
      return
    }

    const timeout = setTimeout(() => {
      setShouldRenderTaskSheet(false)
    }, 300)

    return () => {
      clearTimeout(timeout)
    }
  }, [shouldKeepTaskSheetMounted])

  const searchParams = useSearchParams()

  // Task selection travels as `?task=` (sheet deep-link convention),
  // alongside the assignee filter this view already carries.
  const buildViewPath = useCallback(
    (targetView: MyTasksView, taskId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (taskId) {
        params.set('task', taskId)
      } else {
        params.delete('task')
      }
      const queryString = params.toString()
      return `/my/tasks/${targetView}${queryString ? `?${queryString}` : ''}`
    },
    [searchParams]
  )

  const handleOpenTask = useCallback(
    (taskId: string) => {
      selectTask(taskId)
    },
    [selectTask]
  )

  const handleSheetChange = useCallback(
    (open: boolean) => {
      if (open) {
        return
      }

      setCreateTaskContext(null)
      // `clear` closes locally first, then replaces the URL so Back doesn't
      // bounce straight back into the sheet.
      clearTask()
      startRefresh(() => {
        router.refresh()
      })
    },
    [clearTask, router, startRefresh]
  )

  const handleReorder = useCallback(
    (update: MyTasksBoardReorderUpdate) => {
      setEntries(update.nextEntries)

      startRefresh(async () => {
        try {
          await reorderMutation.mutateAsync({
            ...update.payload,
            assigneeId: selectedAssigneeId,
          })
          router.refresh()
        } catch {
          setEntries(update.previousEntries)
        }
      })
    },
    [reorderMutation, router, selectedAssigneeId, startRefresh]
  )

  const totalTaskCount = entries.length

  // `?task=new` opens the create sheet (shared convention), so an "add task"
  // link is shareable; the local context only carries the seed defaults for
  // the column the create was started from.
  const handleStartCreateTask = useCallback(
    (status: MyTaskStatus = 'ON_DECK') => {
      setCreateTaskContext({
        status,
        assigneeId: user.id,
        projectId: null,
      })
      openCreateTask()
    },
    [openCreateTask, user.id]
  )

  const viewTabs = [
    {
      value: 'board',
      label: 'Board',
      href: buildViewPath('board', resolvedTaskId),
    },
    {
      value: 'calendar',
      label: 'Calendar',
      href: buildViewPath('calendar', resolvedTaskId),
    },
  ]

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/my/tasks/board')}
      tabs={viewTabs}
      activeTab={view}
      count={{ label: 'tasks', total: totalTaskCount }}
      primaryAction={
        <div className='flex items-center gap-2'>
          <ClientSelector
            clients={clients}
            selectedClientId={selectedClientId}
            hiddenProjectTypes={hiddenProjectTypes}
          />
          <PersonSelector
            admins={admins}
            selectedUserId={selectedAssigneeId}
            currentUserId={user.id}
          />
          <Button
            type='button'
            size='sm'
            onClick={() => handleStartCreateTask('ON_DECK')}
          >
            <Plus className='h-4 w-4' />
            Add task
          </Button>
        </div>
      }
      // The board pins to the viewport (columns scroll internally) and needs
      // the min-h-0 clamp back; other views flow with the document.
      contentClassName={
        view === 'board'
          ? 'flex h-full min-h-0 flex-col gap-4 sm:gap-6'
          : 'flex flex-col gap-4 sm:gap-6'
      }
    >
      {view === 'board' ? (
        // Only truly empty when nothing is hidden either. With older DONE
        // tasks outside the window the board must still render, or its
        // "load previous two weeks" control never mounts and those tasks are
        // unreachable at any window size.
        boardEntries.length === 0 && olderDoneCount === 0 ? (
          <ProjectsBoardEmpty
            title='No tasks assigned'
            description='Once a task is assigned to you, it will appear here.'
          />
        ) : (
          <MyTasksBoard
            canReorder={selectedAssigneeId !== 'all'}
            entries={boardEntries}
            taskLookup={taskLookup}
            renderAssignees={renderAssignees}
            getTaskCardOptions={getTaskCardOptions}
            onOpenTask={handleOpenTask}
            onReorder={handleReorder}
            activeTaskId={resolvedTaskId}
            scrollStorageKey={boardScrollStorageKey}
            onCreateTask={handleStartCreateTask}
            doneWeeks={doneWeeks}
            olderDoneCount={olderDoneCount}
            onLoadOlderDone={handleLoadOlderDone}
            isLoadingOlderDone={isLoadingOlderDone}
            doneWindowError={doneWindowError}
          />
        )
      ) : (
        <MyTasksCalendar
          entries={entries}
          taskLookup={taskLookup}
          renderAssignees={renderAssignees}
          onOpenTask={handleOpenTask}
          activeTaskId={resolvedTaskId}
          onDueDateChange={handleDueDateChange}
          onRefresh={handleCalendarRefresh}
          scrollStorageKey={calendarScrollStorageKey}
        />
      )}
      {shouldRenderTaskSheet ? (
        <TaskSheet
          open={isSheetOpen}
          onOpenChange={handleSheetChange}
          task={editingTaskMeta?.task}
          canManage
          admins={admins}
          currentUserId={user.id}
          defaultStatus={createTaskContext?.status ?? 'ON_DECK'}
          defaultDueOn={null}
          projects={allProjects}
          projectSelectionProjects={projectSelectionProjects}
          defaultProjectId={
            createTaskContext?.projectId ?? editingTaskMeta?.project.id ?? null
          }
          defaultAssigneeId={createTaskContext?.assigneeId ?? null}
        />
      ) : null}
    </PageShell>
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
  const directory = new Map<
    string,
    { name: string; avatarUrl: string | null }
  >()

  projects.forEach(project => {
    project.members.forEach(member => {
      const user = member.user
      const name =
        user.full_name?.trim() ||
        user.email?.split('@')[0] ||
        'Unassigned member'
      directory.set(user.id, { name, avatarUrl: user.avatar_url })
    })
  })

  admins.forEach(admin => {
    const name =
      admin.full_name?.trim() || admin.email?.split('@')[0] || 'Administrator'
    directory.set(admin.id, { name, avatarUrl: admin.avatar_url })
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
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${project.slug}/tasks`
  }

  if (project.type === 'PERSONAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${project.slug}/tasks`
  }

  const clientSlug = project.client?.slug ?? null

  if (!clientSlug) {
    return null
  }

  return `/projects/${clientSlug}/${project.slug}/tasks`
}

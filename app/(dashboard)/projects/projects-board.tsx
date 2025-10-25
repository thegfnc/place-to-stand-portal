'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Loader2, Plus } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Label } from '@/components/ui/label'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { cn } from '@/lib/utils'
import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

import { changeTaskStatus } from './actions'
import { TaskCard, TaskCardPreview } from './task-card'
import { TaskSheet } from './task-sheet'

const BOARD_COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'ON_DECK', label: 'On Deck' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'BLOCKED', label: 'Blocked' },
  { id: 'DONE', label: 'Done' },
  { id: 'ARCHIVED', label: 'Archived' },
] as const

type BoardColumnId = (typeof BOARD_COLUMNS)[number]['id']

const BOARD_BASE_PATH = '/projects'

type Props = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
  activeClientId: string | null
  activeProjectId: string | null
  activeTaskId: string | null
}

const MISSING_SLUG_MESSAGE =
  'This project is missing a slug. Update it in Settings -> Projects.'
const NO_CLIENT_PROJECTS_MESSAGE = 'This client does not have any projects yet.'

const areTaskCollectionsEqual = (
  a: TaskWithRelations[] | undefined,
  b: TaskWithRelations[]
) => {
  if (!a) return b.length === 0
  if (a.length !== b.length) return false

  const snapshot = new Map(
    a.map(task => [task.id, `${task.status}-${task.updated_at}`])
  )

  return b.every(
    task => snapshot.get(task.id) === `${task.status}-${task.updated_at}`
  )
}

export function ProjectsBoard({
  projects,
  clients,
  currentUserId,
  currentUserRole,
  admins,
  activeClientId,
  activeProjectId,
  activeTaskId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    () => {
      if (activeClientId) {
        return activeClientId
      }

      if (activeProjectId) {
        const project = projects.find(item => item.id === activeProjectId)
        if (project?.client_id) {
          return project.client_id
        }
      }

      const firstProjectClientId = projects.find(
        item => item.client_id
      )?.client_id
      if (firstProjectClientId) {
        return firstProjectClientId
      }

      return clients[0]?.id ?? null
    }
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => activeProjectId ?? projects[0]?.id ?? null
  )
  const [isPending, startTransition] = useTransition()
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(() => Boolean(activeTaskId))
  const [sheetTask, setSheetTask] = useState<TaskWithRelations | undefined>(
    () => {
      if (!activeTaskId) {
        return undefined
      }

      for (const project of projects) {
        const match = project.tasks.find(task => task.id === activeTaskId)
        if (match) {
          return match
        }
      }

      return undefined
    }
  )
  const [routeTaskId, setRouteTaskId] = useState<string | null>(activeTaskId)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [scrimLocked, setScrimLocked] = useState(false)
  const projectLookup = useMemo(() => {
    const map = new Map<string, ProjectWithRelations>()
    projects.forEach(project => {
      map.set(project.id, project)
    })
    return map
  }, [projects])
  const projectsByClientId = useMemo(() => {
    const map = new Map<string, ProjectWithRelations[]>()
    projects.forEach(project => {
      if (!project.client_id) {
        return
      }
      const list = map.get(project.client_id) ?? []
      list.push(project)
      map.set(project.client_id, list)
    })
    return map
  }, [projects])
  const clientSlugLookup = useMemo(() => {
    const map = new Map<string, string | null>()
    clients.forEach(client => {
      map.set(client.id, client.slug ?? null)
    })
    return map
  }, [clients])
  const buildBoardPath = useCallback(
    (projectId: string, taskId?: string | null) => {
      const project = projectLookup.get(projectId)

      if (!project) {
        return null
      }

      const projectSlug = project.slug ?? null
      const clientId = project.client_id ?? null
      const clientSlug =
        project.client?.slug ??
        (clientId ? (clientSlugLookup.get(clientId) ?? null) : null)

      if (!projectSlug || !clientSlug) {
        return null
      }

      const basePath = `${BOARD_BASE_PATH}/${clientSlug}/${projectSlug}/board`
      return taskId ? `${basePath}/${taskId}` : basePath
    },
    [clientSlugLookup, projectLookup]
  )
  const navigateToProject = useCallback(
    (
      projectId: string | null,
      options: { taskId?: string | null; replace?: boolean } = {}
    ) => {
      const { taskId = null, replace = false } = options

      if (!projectId) {
        if (pathname !== BOARD_BASE_PATH) {
          if (replace) {
            router.replace(BOARD_BASE_PATH, { scroll: false })
          } else {
            router.push(BOARD_BASE_PATH, { scroll: false })
          }
        }
        return
      }

      const path = buildBoardPath(projectId, taskId)

      if (!path) {
        setFeedback(prev =>
          prev === MISSING_SLUG_MESSAGE ? prev : MISSING_SLUG_MESSAGE
        )
        return
      }

      setFeedback(prev => (prev === MISSING_SLUG_MESSAGE ? null : prev))

      if (pathname === path) {
        return
      }

      if (replace) {
        router.replace(path, { scroll: false })
      } else {
        router.push(path, { scroll: false })
      }
    },
    [buildBoardPath, pathname, router]
  )
  const [tasksByProject, setTasksByProject] = useState(() => {
    const map = new Map<string, TaskWithRelations[]>()
    projects.forEach(project => {
      map.set(project.id, project.tasks)
    })
    return map
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) {
      return [] as ProjectWithRelations[]
    }

    return projects.filter(project => project.client_id === selectedClientId)
  }, [projects, selectedClientId])

  const clientItems = useMemo(
    () =>
      clients.map(client => ({
        value: client.id,
        label: client.name,
        keywords: [client.name],
      })),
    [clients]
  )

  const projectItems = useMemo(
    () =>
      filteredProjects.map(project => ({
        value: project.id,
        label: project.name,
        keywords: [project.name],
      })),
    [filteredProjects]
  )
  useEffect(() => {
    if (activeClientId && selectedClientId !== activeClientId) {
      startTransition(() => {
        setSelectedClientId(activeClientId)
      })
      return
    }
  }, [activeClientId, selectedClientId, startTransition])
  useEffect(() => {
    if (activeProjectId && selectedProjectId !== activeProjectId) {
      startTransition(() => {
        setSelectedProjectId(activeProjectId)
      })
    }
  }, [activeProjectId, selectedProjectId, startTransition])
  useEffect(() => {
    if (selectedClientId && projectItems.length === 0) {
      startTransition(() => {
        setFeedback(prev =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
      })
      return
    }

    startTransition(() => {
      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))
    })
  }, [projectItems.length, selectedClientId, startTransition])
  const handleClientSelect = useCallback(
    (clientId: string) => {
      startTransition(() => {
        setSelectedClientId(clientId)
      })

      const clientProjects = projectsByClientId.get(clientId) ?? []

      if (clientProjects.length === 0) {
        setFeedback(prev =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
        startTransition(() => {
          setSelectedProjectId(null)
        })
        return
      }

      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))

      const currentSelectionStillValid = clientProjects.some(
        project => project.id === selectedProjectId
      )

      const nextProjectId = currentSelectionStillValid
        ? selectedProjectId
        : (clientProjects[0]?.id ?? null)

      startTransition(() => {
        setSelectedProjectId(nextProjectId)
      })

      if (nextProjectId) {
        navigateToProject(nextProjectId, { replace: true })
      }
    },
    [navigateToProject, projectsByClientId, selectedProjectId, startTransition]
  )
  const handleProjectSelect = useCallback(
    (projectId: string | null) => {
      startTransition(() => {
        setSelectedProjectId(projectId)
      })

      if (!projectId) {
        navigateToProject(null)
        return
      }

      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))
      navigateToProject(projectId)
    },
    [navigateToProject, startTransition]
  )

  useEffect(() => {
    if (filteredProjects.length === 0) {
      startTransition(() => {
        setSelectedProjectId(null)
      })
      return
    }

    if (
      !selectedProjectId ||
      !filteredProjects.some(project => project.id === selectedProjectId)
    ) {
      const nextProjectId = filteredProjects[0]?.id ?? null
      startTransition(() => {
        setSelectedProjectId(nextProjectId)
        if (nextProjectId) {
          navigateToProject(nextProjectId, { replace: true })
        }
      })
    }
  }, [filteredProjects, navigateToProject, selectedProjectId, startTransition])

  useEffect(() => {
    startTransition(() => {
      setTasksByProject(prev => {
        let didChange = false
        const next = new Map(prev)
        const incomingProjectIds = new Set<string>()

        projects.forEach(project => {
          incomingProjectIds.add(project.id)
          const existing = next.get(project.id)
          if (!areTaskCollectionsEqual(existing, project.tasks)) {
            next.set(project.id, project.tasks)
            didChange = true
          }
        })

        for (const projectId of next.keys()) {
          if (!incomingProjectIds.has(projectId)) {
            next.delete(projectId)
            didChange = true
          }
        }

        return didChange ? next : prev
      })
    })
  }, [projects, startTransition])

  const activeProject =
    filteredProjects.find(project => project.id === selectedProjectId) ?? null
  const activeProjectTasks = useMemo(() => {
    if (!activeProject) return [] as TaskWithRelations[]
    return tasksByProject.get(activeProject.id) ?? activeProject.tasks
  }, [activeProject, tasksByProject])
  const canManageTasks = useMemo(() => {
    if (!activeProject) return false
    if (currentUserRole === 'ADMIN') return true

    return activeProject.members.some(
      member => member.user_id === currentUserId && member.role !== 'VIEWER'
    )
  }, [activeProject, currentUserId, currentUserRole])

  const memberDirectory = useMemo(() => {
    const directory = new Map<string, { name: string }>()

    if (activeProject) {
      activeProject.members.forEach(member => {
        directory.set(member.user_id, {
          name: member.user.full_name ?? member.user.email,
        })
      })
    }

    // Include administrators who may not be listed as project members.
    admins.forEach(admin => {
      if (!directory.has(admin.id)) {
        directory.set(admin.id, {
          name: admin.full_name ?? admin.email,
        })
      }
    })

    return directory
  }, [activeProject, admins])

  const tasksByColumn = useMemo(() => {
    const map = new Map<BoardColumnId, TaskWithRelations[]>()

    BOARD_COLUMNS.forEach(column => {
      map.set(column.id, [])
    })

    if (!activeProject) {
      return map
    }

    ;[...activeProjectTasks]
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .forEach(task => {
        if (!map.has(task.status as BoardColumnId)) {
          map.set(task.status as BoardColumnId, [])
        }

        map.get(task.status as BoardColumnId)!.push(task)
      })

    return map
  }, [activeProject, activeProjectTasks])
  useEffect(() => {
    if (activeTaskId) {
      const nextTask =
        activeProjectTasks.find(task => task.id === activeTaskId) ?? null

      startTransition(() => {
        setRouteTaskId(activeTaskId)
        setPendingTaskId(null)
        if (nextTask) {
          setSheetTask(nextTask)
          setIsSheetOpen(true)
        }
      })
      return
    }

    if (pendingTaskId) {
      return
    }

    if (routeTaskId) {
      startTransition(() => {
        setRouteTaskId(null)
        setSheetTask(prev =>
          prev && prev.id === routeTaskId ? undefined : prev
        )
        setIsSheetOpen(false)
      })
    }
  }, [
    activeProjectTasks,
    activeTaskId,
    pendingTaskId,
    routeTaskId,
    startTransition,
  ])

  const draggingTask = useMemo(() => {
    if (!dragTaskId) return null
    return activeProjectTasks.find(task => task.id === dragTaskId) ?? null
  }, [activeProjectTasks, dragTaskId])

  const addTaskDisabled = !activeProject || !canManageTasks
  const addTaskDisabledReason = !activeProject
    ? 'Select a project to add tasks.'
    : !canManageTasks
      ? 'You need manage permissions to add tasks.'
      : null

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id)
    setDragTaskId(taskId)
  }

  const handleDragOver = () => {
    // Not implementing intra-column ordering in Phase 1.
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDragTaskId(null)

    if (!canManageTasks || !activeProject) {
      return
    }

    const { active, over } = event

    if (!over) {
      return
    }

    const destinationStatus = over.id as BoardColumnId
    const activeData = active.data.current as
      | { type: string; taskId: string; projectId: string }
      | undefined

    if (!activeData || activeData.type !== 'task') {
      return
    }

    const { taskId, projectId } = activeData
    const projectTasks = tasksByProject.get(projectId)
    const task = projectTasks?.find(item => item.id === taskId)

    if (!task || task.status === destinationStatus) {
      return
    }

    const previousStatus = task.status as BoardColumnId

    setFeedback(null)
    setTasksByProject(prev => {
      const currentProjectTasks = prev.get(projectId)
      if (!currentProjectTasks) {
        return prev
      }

      const updatedProjectTasks = currentProjectTasks.map(item =>
        item.id === taskId ? { ...item, status: destinationStatus } : item
      )

      const next = new Map(prev)
      next.set(projectId, updatedProjectTasks)
      return next
    })

    startTransition(async () => {
      const result = await changeTaskStatus({
        taskId,
        status: destinationStatus,
      })

      if (result.error) {
        setFeedback(result.error)
        setTasksByProject(prev => {
          const currentProjectTasks = prev.get(projectId)
          if (!currentProjectTasks) {
            return prev
          }

          const revertedProjectTasks = currentProjectTasks.map(item =>
            item.id === taskId ? { ...item, status: previousStatus } : item
          )

          const next = new Map(prev)
          next.set(projectId, revertedProjectTasks)
          return next
        })
      }
    })
  }

  const openCreateSheet = useCallback(() => {
    const targetProjectId = selectedProjectId ?? activeProject?.id ?? null

    if (targetProjectId) {
      navigateToProject(targetProjectId, { taskId: null, replace: true })
    } else {
      navigateToProject(null, { replace: true })
    }

    setRouteTaskId(null)
    setPendingTaskId(null)
    setSheetTask(undefined)
    setIsSheetOpen(true)
  }, [activeProject?.id, navigateToProject, selectedProjectId])

  const handleEditTask = (task: TaskWithRelations) => {
    setScrimLocked(true)
    setRouteTaskId(task.id)
    setPendingTaskId(task.id)
    navigateToProject(task.project_id, { taskId: task.id })
  }

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    if (!open) {
      const projectIdForSheet = sheetTask?.project_id ?? selectedProjectId

      if (routeTaskId && projectIdForSheet) {
        setScrimLocked(true)
        startTransition(() => {
          setRouteTaskId(null)
          setPendingTaskId(null)
          navigateToProject(projectIdForSheet, {
            taskId: null,
            replace: true,
          })
        })
      }

      setSheetTask(undefined)
    }
  }

  const headerContent = useMemo(
    () => (
      <div className='flex w-full flex-wrap items-end gap-3'>
        <div className='min-w-[200px] space-y-1'>
          <Label htmlFor='projects-client-select'>Client</Label>
          <SearchableCombobox
            id='projects-client-select'
            items={clientItems}
            value={selectedClientId ?? ''}
            onChange={handleClientSelect}
            placeholder='Select client'
            searchPlaceholder='Search clients...'
            disabled={clientItems.length === 0}
            ariaLabel='Select client'
          />
        </div>
        <div className='min-w-60 space-y-1'>
          <Label htmlFor='projects-project-select'>Project</Label>
          <SearchableCombobox
            id='projects-project-select'
            items={projectItems}
            value={selectedProjectId ?? ''}
            onChange={handleProjectSelect}
            placeholder='Select project'
            searchPlaceholder='Search projects...'
            disabled={projectItems.length === 0}
            ariaLabel='Select project'
          />
        </div>
      </div>
    ),
    [
      clientItems,
      handleClientSelect,
      handleProjectSelect,
      projectItems,
      selectedClientId,
      selectedProjectId,
    ]
  )

  const introContent = (
    <div className='flex flex-wrap items-center justify-between gap-4'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Project board</h1>
        <p className='text-muted-foreground text-sm'>
          Drag tasks between columns to update status. Filters respect your
          project assignments.
        </p>
      </div>
      <DisabledFieldTooltip
        disabled={addTaskDisabled}
        reason={addTaskDisabledReason}
      >
        <Button
          onClick={openCreateSheet}
          disabled={addTaskDisabled}
          className='flex items-center gap-2'
        >
          <Plus className='h-4 w-4' /> Add task
        </Button>
      </DisabledFieldTooltip>
    </div>
  )

  const renderAssignees = (task: TaskWithRelations) => {
    return task.assignees
      .map(assignee => ({
        id: assignee.user_id,
        name: memberDirectory.get(assignee.user_id)?.name ?? 'Unknown',
      }))
      .filter(
        (assignee, index, array) =>
          array.findIndex(item => item.id === assignee.id) === index
      )
  }

  if (projects.length === 0) {
    return (
      <>
        <AppShellHeader>{headerContent}</AppShellHeader>
        <div className='flex h-full flex-col gap-6'>
          {introContent}
          <div className='grid w-full flex-1 place-items-center rounded-xl border border-dashed p-12 text-center'>
            <div className='space-y-2'>
              <h2 className='text-lg font-semibold'>
                No projects assigned yet
              </h2>
              <p className='text-muted-foreground text-sm'>
                Once an administrator links you to a project, the workspace will
                unlock here.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppShellHeader>{headerContent}</AppShellHeader>
      <div className='flex h-full flex-col gap-6'>
        {introContent}
        {feedback ? (
          <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
            {feedback}
          </p>
        ) : null}
        {!activeProject ? (
          <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
            <div className='space-y-2'>
              <h2 className='text-lg font-semibold'>No project selected</h2>
              <p className='text-muted-foreground text-sm'>
                Choose a client and project above to view the associated tasks.
              </p>
            </div>
          </div>
        ) : (
          <div className='relative flex-1'>
            <div className='absolute inset-0 overflow-hidden'>
              <div className='h-full overflow-x-auto pb-6'>
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className='flex min-h-full w-max gap-4 p-1'>
                    {BOARD_COLUMNS.map(column => (
                      <KanbanColumn
                        key={column.id}
                        columnId={column.id}
                        label={column.label}
                        tasks={
                          tasksByColumn.get(column.id as BoardColumnId) ?? []
                        }
                        renderAssignees={renderAssignees}
                        onEditTask={handleEditTask}
                        canManage={canManageTasks}
                        activeTaskId={sheetTask?.id ?? null}
                      />
                    ))}
                  </div>
                  <DragOverlay dropAnimation={null}>
                    {draggingTask ? (
                      <TaskCardPreview
                        task={draggingTask}
                        assignees={renderAssignees(draggingTask)}
                      />
                    ) : null}
                  </DragOverlay>
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
            admins={admins}
          />
        ) : null}
      </div>
    </>
  )
}

type KanbanColumnProps = {
  columnId: BoardColumnId
  label: string
  tasks: TaskWithRelations[]
  canManage: boolean
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string }>
  onEditTask: (task: TaskWithRelations) => void
  activeTaskId: string | null
}

function KanbanColumn({
  columnId,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background/80 flex h-full w-80 shrink-0 flex-col gap-4 rounded-xl border p-4 shadow-sm transition',
        isOver && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            {label}
          </h2>
        </div>
        <span className='text-muted-foreground text-xs'>{tasks.length}</span>
      </div>
      <div className='flex flex-1 flex-col gap-3'>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            assignees={renderAssignees(task)}
            onEdit={onEditTask}
            draggable={canManage}
            isActive={task.id === activeTaskId}
          />
        ))}
      </div>
    </div>
  )
}

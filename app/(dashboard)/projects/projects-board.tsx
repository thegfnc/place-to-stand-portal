'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
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

type Props = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string }>
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
}

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
}: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    if (clients.length === 1) {
      return clients[0].id
    }
    return 'all'
  })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => projects[0]?.id ?? null
  )
  const [isPending, startTransition] = useTransition()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetTask, setSheetTask] = useState<TaskWithRelations | undefined>()
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
    if (selectedClientId === 'all') {
      return projects
    }

    return projects.filter(project => project.client_id === selectedClientId)
  }, [projects, selectedClientId])

  const clientItems = useMemo(
    () => [
      {
        value: 'all',
        label: 'All clients',
        keywords: ['all'],
      },
      ...clients.map(client => ({
        value: client.id,
        label: client.name,
        keywords: [client.name],
      })),
    ],
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
      startTransition(() => {
        setSelectedProjectId(filteredProjects[0]?.id ?? null)
      })
    }
  }, [filteredProjects, selectedProjectId, startTransition])

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

  const activeTask =
    activeProjectTasks.find(task => task.id === activeTaskId) ?? null

  const addTaskDisabled = !activeProject || !canManageTasks
  const addTaskDisabledReason = !activeProject
    ? 'Select a project to add tasks.'
    : !canManageTasks
      ? 'You need manage permissions to add tasks.'
      : null

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id)
    setActiveTaskId(taskId)
  }

  const handleDragOver = () => {
    // Not implementing intra-column ordering in Phase 1.
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null)

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
    setSheetTask(undefined)
    setIsSheetOpen(true)
  }, [])

  const handleEditTask = (task: TaskWithRelations) => {
    setSheetTask(task)
    setIsSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    if (!open) {
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
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder='Select client'
            searchPlaceholder='Search clients...'
            ariaLabel='Select client'
          />
        </div>
        <div className='min-w-60 space-y-1'>
          <Label htmlFor='projects-project-select'>Project</Label>
          <SearchableCombobox
            id='projects-project-select'
            items={projectItems}
            value={selectedProjectId}
            onChange={value => setSelectedProjectId(value)}
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
      projectItems,
      selectedClientId,
      selectedProjectId,
      setSelectedClientId,
      setSelectedProjectId,
    ]
  )

  const introContent = (
    <div className='flex flex-wrap items-start justify-between gap-4'>
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
                    {activeTask ? (
                      <TaskCardPreview
                        task={activeTask}
                        assignees={renderAssignees(activeTask)}
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
            {isPending ? (
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

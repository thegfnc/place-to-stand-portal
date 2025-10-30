import Link from 'next/link'
import type { RefObject, UIEventHandler } from 'react'
import { DndContext, type DndContextProps } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'

import {
  BACKLOG_SECTIONS,
  BOARD_COLUMNS,
} from '@/lib/projects/board/board-constants'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

import { BacklogSection } from '../backlog-section'
import { KanbanColumn } from '../kanban-column'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

const NO_SELECTION_TITLE = 'No project selected'
const NO_SELECTION_DESCRIPTION =
  'Choose a client and project above to view the associated tasks.'

export type ProjectsBoardTabsProps = {
  initialTab: 'board' | 'backlog' | 'activity'
  boardHref: string
  backlogHref: string
  activityHref: string
  backlogDisabled: boolean
  activityDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
  feedback: string | null
  activeProject: {
    id: string
    name: string
    client: { id: string | null; name: string | null } | null
    burndown: {
      totalClientRemainingHours: number
      totalProjectLoggedHours: number
    }
  } | null
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  onDeckTasks: TaskWithRelations[]
  backlogTasks: TaskWithRelations[]
  activeSheetTaskId: string | null
  activityTargetClientId: string | null
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    boardHref,
    backlogHref,
    activityHref,
    backlogDisabled,
    activityDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onDragEnd,
    draggingTask,
    scrimLocked,
    isPending,
    boardViewportRef,
    onBoardScroll,
    onDeckTasks,
    backlogTasks,
    activeSheetTaskId,
    activityTargetClientId,
  } = props

  return (
    <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
          <TabsTrigger value='board' className='px-3 py-1.5 text-sm' asChild>
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
                backlogDisabled ? 'pointer-events-none opacity-50' : undefined
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
                activityDisabled ? 'pointer-events-none opacity-50' : undefined
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
                  onAssignedFilterChange(value === true)
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
          {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
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
                  onScroll={onBoardScroll}
                >
                  <DndContext
                    sensors={sensors}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  >
                    <div className='flex h-full w-max gap-4 p-1'>
                      {BOARD_COLUMNS.map(column => (
                        <KanbanColumn
                          key={column.id}
                          columnId={column.id}
                          label={column.label}
                          tasks={tasksByColumn.get(column.id) ?? []}
                          renderAssignees={renderAssignees}
                          onEditTask={onEditTask}
                          canManage={canManageTasks}
                          activeTaskId={activeSheetTaskId}
                          onCreateTask={onCreateTask}
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
          {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
          {!activeProject ? (
            <ProjectsBoardEmpty
              title={NO_SELECTION_TITLE}
              description={NO_SELECTION_DESCRIPTION}
            />
          ) : (
            <div className='relative min-h-0 flex-1'>
              <DndContext
                sensors={sensors}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              >
                <div className='flex min-h-0 flex-1 flex-col gap-4'>
                  <BacklogSection
                    status={BACKLOG_SECTIONS[0].id}
                    label='On Deck'
                    tasks={onDeckTasks}
                    canManage={canManageTasks}
                    renderAssignees={renderAssignees}
                    onEditTask={onEditTask}
                    activeTaskId={activeSheetTaskId}
                    onCreateTask={onCreateTask}
                  />
                  <BacklogSection
                    status={BACKLOG_SECTIONS[1].id}
                    label='Backlog'
                    tasks={backlogTasks}
                    canManage={canManageTasks}
                    renderAssignees={renderAssignees}
                    onEditTask={onEditTask}
                    activeTaskId={activeSheetTaskId}
                    onCreateTask={onCreateTask}
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
                  clientId={activityTargetClientId}
                  emptyState='No project activity yet.'
                />
              </div>
            </section>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  )
}

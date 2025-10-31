'use client'

import { useMemo } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

export type ArchiveActionKind = 'unaccept' | 'restore' | 'destroy'

export type ArchiveTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onAcceptAllDone: () => void
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
  isAcceptingDone: boolean
  onUnacceptTask: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onDestroyTask: (taskId: string) => void
  archiveActionTaskId: string | null
  archiveActionType: ArchiveActionKind | null
  archiveActionDisabledReason: string | null
  isArchiveActionPending: boolean
}

const ACCEPTED_TITLE = 'Accepted tasks awaiting client sign-off'
const ARCHIVED_TITLE = 'Archived tasks'

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return formatDistanceToNow(parsed, { addSuffix: true })
  } catch {
    return value
  }
}

const summarizeAssignees = (
  task: TaskWithRelations,
  renderAssignees: RenderAssigneeFn
) => {
  const assignees = renderAssignees(task)
  if (!assignees.length) {
    return 'Unassigned'
  }
  return assignees.map(person => person.name).join(', ')
}

export function ArchiveTabContent(props: ArchiveTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    acceptedTasks,
    archivedTasks,
    renderAssignees,
    onEditTask,
    onAcceptAllDone,
    acceptAllDisabled,
    acceptAllDisabledReason,
    isAcceptingDone,
    onUnacceptTask,
    onRestoreTask,
    onDestroyTask,
    archiveActionTaskId,
    archiveActionType,
    archiveActionDisabledReason,
    isArchiveActionPending,
  } = props

  const sortedAccepted = useMemo(() => {
    return acceptedTasks.slice().sort((a, b) => {
      const aTime = a.accepted_at ? Date.parse(a.accepted_at) : 0
      const bTime = b.accepted_at ? Date.parse(b.accepted_at) : 0
      return bTime - aTime
    })
  }, [acceptedTasks])

  const sortedArchived = useMemo(() => {
    return archivedTasks.slice().sort((a, b) => {
      const aTime = a.deleted_at ? Date.parse(a.deleted_at) : 0
      const bTime = b.deleted_at ? Date.parse(b.deleted_at) : 0
      return bTime - aTime
    })
  }, [archivedTasks])

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='archive'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='flex min-h-0 flex-1 flex-col gap-6'>
          <section className='bg-background rounded-xl border p-6 shadow-sm'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='space-y-1'>
                <h3 className='text-lg font-semibold'>{ACCEPTED_TITLE}</h3>
                <p className='text-muted-foreground text-sm'>
                  Tasks in Done that have been accepted by an administrator.
                </p>
              </div>
              <DisabledFieldTooltip
                disabled={acceptAllDisabled || isAcceptingDone}
                reason={acceptAllDisabledReason}
              >
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={onAcceptAllDone}
                  disabled={acceptAllDisabled || isAcceptingDone}
                >
                  {isAcceptingDone ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : null}
                  Accept all Done tasks
                </Button>
              </DisabledFieldTooltip>
            </div>
            <div className='mt-4 overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Task
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Assignees
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Accepted
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Updated
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right text-xs font-semibold uppercase'>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAccepted.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className='text-muted-foreground py-8 text-center text-sm'
                        colSpan={5}
                      >
                        No tasks have been accepted yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAccepted.map(task => {
                      const isCurrentAction =
                        isArchiveActionPending &&
                        archiveActionTaskId === task.id &&
                        archiveActionType === 'unaccept'
                      const blockOtherActions =
                        isArchiveActionPending &&
                        archiveActionTaskId !== task.id
                      const disabledReason =
                        archiveActionDisabledReason ??
                        (blockOtherActions
                          ? 'Please wait for the current task update to finish.'
                          : null)

                      return (
                        <TableRow
                          key={task.id}
                          role='button'
                          tabIndex={0}
                          onClick={() => onEditTask(task)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onEditTask(task)
                            }
                          }}
                          className='hover:bg-muted/50 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none'
                        >
                          <TableCell className='py-3 align-top text-sm font-medium'>
                            {task.title}
                          </TableCell>
                          <TableCell className='text-muted-foreground py-3 text-sm'>
                            {summarizeAssignees(task, renderAssignees)}
                          </TableCell>
                          <TableCell className='text-muted-foreground py-3 text-sm'>
                            {formatTimestamp(task.accepted_at)}
                          </TableCell>
                          <TableCell className='text-muted-foreground py-3 text-sm'>
                            {formatTimestamp(task.updated_at)}
                          </TableCell>
                          <TableCell className='py-3 text-right'>
                            <DisabledFieldTooltip
                              disabled={Boolean(disabledReason)}
                              reason={disabledReason}
                            >
                              <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                onClick={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  onUnacceptTask(task.id)
                                }}
                                disabled={
                                  Boolean(disabledReason) || isCurrentAction
                                }
                              >
                                {isCurrentAction ? (
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                ) : null}
                                Unaccept
                              </Button>
                            </DisabledFieldTooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className='bg-background rounded-xl border p-6 shadow-sm'>
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>{ARCHIVED_TITLE}</h3>
              <p className='text-muted-foreground text-sm'>
                Archived tasks are kept for reference. Restore them to make
                updates or permanently delete them to remove them from the
                project.
              </p>
            </div>
            <div className='mt-4 overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Task
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Deleted
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Updated
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right text-xs font-semibold uppercase'>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedArchived.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className='text-muted-foreground py-8 text-center text-sm'
                        colSpan={4}
                      >
                        No archived tasks yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedArchived.map(task => {
                      const isRestoreAction =
                        isArchiveActionPending &&
                        archiveActionTaskId === task.id &&
                        archiveActionType === 'restore'
                      const isDestroyAction =
                        isArchiveActionPending &&
                        archiveActionTaskId === task.id &&
                        archiveActionType === 'destroy'
                      const blockOtherActions =
                        isArchiveActionPending &&
                        archiveActionTaskId !== task.id
                      const disabledReason =
                        archiveActionDisabledReason ??
                        (blockOtherActions
                          ? 'Please wait for the current task update to finish.'
                          : null)

                      return (
                        <TableRow
                          key={task.id}
                          role='button'
                          tabIndex={0}
                          onClick={() => onEditTask(task)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onEditTask(task)
                            }
                          }}
                          className='hover:bg-muted/50 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none'
                        >
                          <TableCell className='py-3 align-top text-sm font-medium'>
                            {task.title}
                          </TableCell>
                          <TableCell className='text-muted-foreground py-3 text-sm'>
                            {formatTimestamp(task.deleted_at)}
                          </TableCell>
                          <TableCell className='text-muted-foreground py-3 text-sm'>
                            {formatTimestamp(task.updated_at)}
                          </TableCell>
                          <TableCell className='py-3 text-right'>
                            <div className='flex justify-end gap-2'>
                              <DisabledFieldTooltip
                                disabled={Boolean(disabledReason)}
                                reason={disabledReason}
                              >
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='outline'
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onRestoreTask(task.id)
                                  }}
                                  disabled={
                                    Boolean(disabledReason) || isRestoreAction
                                  }
                                >
                                  {isRestoreAction ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                  ) : null}
                                  Restore
                                </Button>
                              </DisabledFieldTooltip>
                              <DisabledFieldTooltip
                                disabled={Boolean(disabledReason)}
                                reason={disabledReason}
                              >
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='destructive'
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onDestroyTask(task.id)
                                  }}
                                  disabled={
                                    Boolean(disabledReason) || isDestroyAction
                                  }
                                >
                                  {isDestroyAction ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                  ) : null}
                                  Delete
                                </Button>
                              </DisabledFieldTooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      )}
    </TabsContent>
  )
}

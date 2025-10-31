'use client'

import { useMemo, useState } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'

export type ReviewActionKind = 'accept' | 'unaccept' | 'restore' | 'destroy'

export type ReviewTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  doneTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onAcceptTask: (taskId: string) => void
  onAcceptAllDone: () => void
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
  isAcceptingDone: boolean
  activeSheetTaskId: string | null
  onUnacceptTask: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onDestroyTask: (taskId: string) => void
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
}

const DONE_BADGE = getTaskStatusToken('DONE')
const ACCEPTED_BADGE = getTaskStatusToken('ACCEPTED')
const ARCHIVED_BADGE = getTaskStatusToken('ARCHIVED')

const formatDueDate = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return format(parsed, 'MMM d, yyyy')
  } catch {
    return value
  }
}

const formatUpdatedAt = (value: string | null | undefined) => {
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

type ReviewTaskDataCellsProps = {
  task: TaskWithRelations
  renderAssignees: RenderAssigneeFn
  updatedAtOverride?: string | null | undefined
}

function ReviewTaskDataCells({
  task,
  renderAssignees,
  updatedAtOverride,
}: ReviewTaskDataCellsProps) {
  const commentCount = task.commentCount ?? 0
  const attachmentCount = task.attachments?.length ?? 0
  const assignedSummary = summarizeAssignees(task, renderAssignees)
  const updatedValue = updatedAtOverride ?? task.updated_at ?? null

  return (
    <>
      <TableCell className='py-3 align-top'>
        <div className='flex flex-col gap-1'>
          <span className='text-sm leading-snug font-medium'>{task.title}</span>
          <span className='text-muted-foreground text-xs'>
            {assignedSummary}
          </span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-center text-xs'>
        {commentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <MessageCircle className='h-3.5 w-3.5' />
            {commentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-center text-xs'>
        {attachmentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <Paperclip className='h-3.5 w-3.5' />
            {attachmentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-sm'>
        {formatDueDate(task.due_on ?? null)}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-sm'>
        {formatUpdatedAt(updatedValue)}
      </TableCell>
    </>
  )
}

export function ReviewTabContent(props: ReviewTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    doneTasks,
    acceptedTasks,
    archivedTasks,
    renderAssignees,
    onEditTask,
    onAcceptTask,
    onAcceptAllDone,
    acceptAllDisabled,
    acceptAllDisabledReason,
    isAcceptingDone,
    activeSheetTaskId,
    onUnacceptTask,
    onRestoreTask,
    onDestroyTask,
    reviewActionTaskId,
    reviewActionType,
    reviewActionDisabledReason,
    isReviewActionPending,
  } = props

  const [destroyTarget, setDestroyTarget] = useState<TaskWithRelations | null>(
    null
  )

  const handleCancelDestroy = () => {
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget) {
      return
    }

    onDestroyTask(destroyTarget.id)
    setDestroyTarget(null)
  }

  const sortedDone = useMemo(() => {
    return doneTasks.slice().sort((a, b) => {
      const aTime = a.updated_at ? Date.parse(a.updated_at) : 0
      const bTime = b.updated_at ? Date.parse(b.updated_at) : 0
      return bTime - aTime
    })
  }, [doneTasks])

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
      value='review'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Delete task permanently?'
        description={
          destroyTarget
            ? `This will permanently remove "${destroyTarget.title}" and all of its history.`
            : 'This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={Boolean(
          isReviewActionPending &&
            reviewActionType === 'destroy' &&
            reviewActionTaskId === destroyTarget?.id
        )}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'>
          <section className='bg-background rounded-xl border shadow-sm'>
            <div className='border-b px-4 py-3'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-sm font-semibold uppercase',
                        DONE_BADGE
                      )}
                    >
                      {getTaskStatusLabel('DONE')}
                    </Badge>
                    <span className='text-muted-foreground text-[11px]'>
                      {sortedDone.length}
                    </span>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    Tasks currently in the Done column awaiting client review.
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
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : null}
                    Accept all Done tasks
                  </Button>
                </DisabledFieldTooltip>
              </div>
            </div>
            <div className='px-2 pt-1 pb-2'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Task
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Comments
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Files
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Due
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
                  {sortedDone.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className='text-muted-foreground py-8 text-center text-sm'
                        colSpan={6}
                      >
                        Nothing in Done yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedDone.map(task => {
                      const isCurrentAction =
                        isReviewActionPending &&
                        reviewActionTaskId === task.id &&
                        reviewActionType === 'accept'
                      const blockOtherActions =
                        isReviewActionPending && reviewActionTaskId !== task.id
                      const disabledReason =
                        reviewActionDisabledReason ??
                        (isAcceptingDone
                          ? 'Accepting all Done tasks…'
                          : blockOtherActions
                            ? 'Please wait for the current task update to finish.'
                            : null)

                      const buttonDisabled =
                        Boolean(disabledReason) ||
                        isCurrentAction ||
                        isAcceptingDone
                      const isActive = task.id === activeSheetTaskId

                      return (
                        <TableRow
                          key={task.id}
                          data-state={isActive ? 'selected' : undefined}
                          role='button'
                          tabIndex={0}
                          onClick={() => onEditTask(task)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onEditTask(task)
                            }
                          }}
                          className={cn(
                            'group cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/50'
                          )}
                        >
                          <ReviewTaskDataCells
                            task={task}
                            renderAssignees={renderAssignees}
                          />
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
                                  onAcceptTask(task.id)
                                }}
                                disabled={buttonDisabled}
                              >
                                {isCurrentAction ? (
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                  <CheckCircle2 className='h-4 w-4' />
                                )}
                                Accept
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

          <section className='bg-background rounded-xl border shadow-sm'>
            <div className='border-b px-4 py-3'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-sm font-semibold uppercase',
                        ACCEPTED_BADGE
                      )}
                    >
                      {getTaskStatusLabel('ACCEPTED')}
                    </Badge>
                    <span className='text-muted-foreground text-[11px]'>
                      {sortedAccepted.length}
                    </span>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    Tasks approved and accepted by client.
                  </p>
                </div>
              </div>
            </div>
            <div className='px-2 pt-1 pb-2'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Task
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Comments
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Files
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Due
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
                        colSpan={6}
                      >
                        No tasks have been accepted yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAccepted.map(task => {
                      const isCurrentAction =
                        isReviewActionPending &&
                        reviewActionTaskId === task.id &&
                        reviewActionType === 'unaccept'
                      const blockOtherActions =
                        isReviewActionPending && reviewActionTaskId !== task.id
                      const disabledReason =
                        reviewActionDisabledReason ??
                        (blockOtherActions
                          ? 'Please wait for the current task update to finish.'
                          : null)
                      const isActive = task.id === activeSheetTaskId
                      const updatedOverride =
                        task.accepted_at ?? task.updated_at ?? null

                      return (
                        <TableRow
                          key={task.id}
                          data-state={isActive ? 'selected' : undefined}
                          role='button'
                          tabIndex={0}
                          onClick={() => onEditTask(task)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onEditTask(task)
                            }
                          }}
                          className={cn(
                            'group cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/50'
                          )}
                        >
                          <ReviewTaskDataCells
                            task={task}
                            renderAssignees={renderAssignees}
                            updatedAtOverride={updatedOverride}
                          />
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
                                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
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

          <section className='bg-background rounded-xl border shadow-sm'>
            <div className='border-b px-4 py-3'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-sm font-semibold uppercase',
                        ARCHIVED_BADGE
                      )}
                    >
                      {getTaskStatusLabel('ARCHIVED')}
                    </Badge>
                    <span className='text-muted-foreground text-[11px]'>
                      {sortedArchived.length}
                    </span>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    Archived tasks remain available for reference until
                    permanently deleted.
                  </p>
                </div>
              </div>
            </div>
            <div className='px-2 pt-1 pb-2'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Task
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Comments
                    </TableHead>
                    <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                      Files
                    </TableHead>
                    <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                      Due
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
                        colSpan={6}
                      >
                        No archived tasks yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedArchived.map(task => {
                      const isRestoreAction =
                        isReviewActionPending &&
                        reviewActionTaskId === task.id &&
                        reviewActionType === 'restore'
                      const isDestroyAction =
                        isReviewActionPending &&
                        reviewActionTaskId === task.id &&
                        reviewActionType === 'destroy'
                      const blockOtherActions =
                        isReviewActionPending && reviewActionTaskId !== task.id
                      const disabledReason =
                        reviewActionDisabledReason ??
                        (blockOtherActions
                          ? 'Please wait for the current task update to finish.'
                          : null)
                      const isActive = task.id === activeSheetTaskId
                      const updatedOverride =
                        task.deleted_at ?? task.updated_at ?? null

                      return (
                        <TableRow
                          key={task.id}
                          data-state={isActive ? 'selected' : undefined}
                          role='button'
                          tabIndex={0}
                          onClick={() => onEditTask(task)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onEditTask(task)
                            }
                          }}
                          className={cn(
                            'group cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/50'
                          )}
                        >
                          <ReviewTaskDataCells
                            task={task}
                            renderAssignees={renderAssignees}
                            updatedAtOverride={updatedOverride}
                          />
                          <TableCell className='py-3 text-right'>
                            <div className='flex justify-end gap-2'>
                              <DisabledFieldTooltip
                                disabled={Boolean(disabledReason)}
                                reason={disabledReason}
                              >
                                <Button
                                  type='button'
                                  size='icon'
                                  variant='secondary'
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onRestoreTask(task.id)
                                  }}
                                  title='Restore task'
                                  aria-label='Restore task'
                                  disabled={
                                    Boolean(disabledReason) || isRestoreAction
                                  }
                                >
                                  {isRestoreAction ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                  ) : (
                                    <RefreshCw className='h-4 w-4' />
                                  )}
                                </Button>
                              </DisabledFieldTooltip>
                              <DisabledFieldTooltip
                                disabled={Boolean(disabledReason)}
                                reason={disabledReason}
                              >
                                <Button
                                  type='button'
                                  size='icon'
                                  variant='destructive'
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setDestroyTarget(task)
                                  }}
                                  title='Delete task permanently'
                                  aria-label='Delete task permanently'
                                  disabled={
                                    Boolean(disabledReason) || isDestroyAction
                                  }
                                >
                                  {isDestroyAction ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                  ) : (
                                    <Trash2 className='h-4 w-4' />
                                  )}
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

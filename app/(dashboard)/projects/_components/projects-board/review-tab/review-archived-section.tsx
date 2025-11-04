import { Loader2, RefreshCw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import type { TaskWithRelations } from '@/lib/types'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'

import type { RenderAssigneeFn } from '../../../../../../lib/projects/board/board-selectors'
import type { ReviewActionKind } from './review-tab.types'
import { ReviewTaskDataCells } from './review-task-data-cells'

type ReviewArchivedSectionProps = {
  tasks: TaskWithRelations[]
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onRestoreTask: (taskId: string) => void
  activeSheetTaskId: string | null
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
  onRequestDestroy: (task: TaskWithRelations) => void
}

const ARCHIVED_BADGE = getTaskStatusToken('ARCHIVED')

export function ReviewArchivedSection({
  tasks,
  renderAssignees,
  onEditTask,
  onRestoreTask,
  activeSheetTaskId,
  reviewActionTaskId,
  reviewActionType,
  reviewActionDisabledReason,
  isReviewActionPending,
  onRequestDestroy,
}: ReviewArchivedSectionProps) {
  return (
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
                {tasks.length}
              </span>
            </div>
            <p className='text-muted-foreground text-xs'>
              Archived tasks remain available for reference until permanently
              deleted.
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
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  className='text-muted-foreground py-8 text-center text-sm'
                  colSpan={6}
                >
                  No archived tasks yet.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map(task => {
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
                              onRequestDestroy(task)
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
  )
}

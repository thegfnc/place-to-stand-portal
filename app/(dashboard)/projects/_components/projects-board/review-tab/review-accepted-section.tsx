import { Loader2 } from 'lucide-react'

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

type ReviewAcceptedSectionProps = {
  tasks: TaskWithRelations[]
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onUnacceptTask: (taskId: string) => void
  activeSheetTaskId: string | null
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
}

const ACCEPTED_BADGE = getTaskStatusToken('ACCEPTED')

export function ReviewAcceptedSection({
  tasks,
  renderAssignees,
  onEditTask,
  onUnacceptTask,
  activeSheetTaskId,
  reviewActionTaskId,
  reviewActionType,
  reviewActionDisabledReason,
  isReviewActionPending,
}: ReviewAcceptedSectionProps) {
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
                  ACCEPTED_BADGE
                )}
              >
                {getTaskStatusLabel('ACCEPTED')}
              </Badge>
              <span className='text-muted-foreground text-[11px]'>
                {tasks.length}
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
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  className='text-muted-foreground py-8 text-center text-sm'
                  colSpan={6}
                >
                  No tasks have been accepted yet.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map(task => {
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
                          disabled={Boolean(disabledReason) || isCurrentAction}
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
  )
}

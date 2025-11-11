import { MessageCircle, Paperclip } from 'lucide-react'

import { TableCell } from '@/components/ui/table'
import type { TaskWithRelations } from '@/lib/types'

import type { RenderAssigneeFn } from '../../../../../../lib/projects/board/board-selectors'
import {
  formatDueDate,
  formatUpdatedAt,
  summarizeAssignees,
} from './review-tab-helpers'

type ReviewTaskDataCellsProps = {
  task: TaskWithRelations
  renderAssignees: RenderAssigneeFn
  updatedAtOverride?: string | null | undefined
}

export function ReviewTaskDataCells({
  task,
  renderAssignees,
  updatedAtOverride,
}: ReviewTaskDataCellsProps) {
  const commentCount = task.commentCount ?? 0
  const attachmentCount =
    task.attachmentCount ?? (task.attachments?.length ?? 0)
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

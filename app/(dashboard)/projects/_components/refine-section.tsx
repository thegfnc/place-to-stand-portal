'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { getTaskStatusLabel } from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

import { RefineSectionHeader } from './refine-section/refine-section-header'
import { RefineTaskRow } from './refine-section/refine-task-row'

type RefineSectionProps = {
  status: BoardColumnId
  label: string
  tasks: TaskWithRelations[]
  canManage: boolean
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string; avatarUrl: string | null }>
  onEditTask: (task: TaskWithRelations) => void
  activeTaskId: string | null
  onCreateTask?: (status: BoardColumnId) => void
  description?: string
  isDropTarget?: boolean
}

export function RefineSection({
  status,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
  onCreateTask,
  description,
  isDropTarget = false,
}: RefineSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      columnId: status,
    },
  })
  const highlight = isOver || isDropTarget
  const sectionDescription = useMemo(() => {
    if (description) {
      return description
    }

    const fallbackLabel = label || getTaskStatusLabel(status)
    return `Tasks currently in the ${fallbackLabel} column awaiting refinement.`
  }, [description, label, status])

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-background rounded-xl border shadow-sm transition',
        highlight && 'ring-primary ring-2'
      )}
    >
      <RefineSectionHeader
        status={status}
        label={label}
        taskCount={tasks.length}
        description={sectionDescription}
        canManage={canManage}
        onCreateTask={onCreateTask}
      />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  className='text-muted-foreground py-8 text-center text-sm'
                  colSpan={5}
                >
                      No tasks yet.
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                id={status}
                items={tasks.map(task => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map(task => (
                  <RefineTaskRow
                    key={task.id}
                    task={task}
                    assignees={renderAssignees(task)}
                    onEdit={onEditTask}
                    draggable={canManage}
                    isActive={task.id === activeTaskId}
                    columnId={status}
                  />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

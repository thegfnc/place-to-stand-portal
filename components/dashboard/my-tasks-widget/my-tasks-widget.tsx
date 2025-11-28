'use client'

import Link from 'next/link'

import type { UserRole } from '@/lib/auth/session'
import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { cn } from '@/lib/utils'
import { useMyTasksWidgetState } from '@/lib/projects/tasks/use-my-tasks-widget-state'
import { Button } from '@/components/ui/button'

import { EmptyState } from './empty-state'
import { TaskList } from './task-list'

type MyTasksWidgetProps = {
  tasks: AssignedTaskSummary[]
  role: UserRole
  totalCount: number
  className?: string
}

export function MyTasksWidget({
  tasks,
  role,
  totalCount,
  className,
}: MyTasksWidgetProps) {
  const description =
    role === 'CLIENT'
      ? 'Tasks you are assigned to across your projects.'
      : 'Assigned work from every active project.'

  const { items } = useMyTasksWidgetState({
    initialTasks: tasks,
  })
  const visibleCount = Math.min(items.length, totalCount)

  return (
    <section
      className={cn(
        'bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='my-tasks-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
        <div className='min-w-0 flex-1'>
          <h2 id='my-tasks-heading' className='text-base font-semibold'>
            My Tasks
          </h2>
          <p className='text-muted-foreground text-xs'>{description}</p>
        </div>
        <div className='flex items-center gap-3'>
          <p className='text-muted-foreground text-xs font-medium'>
            {visibleCount} of {totalCount} tasks
          </p>
          <Button asChild size='sm' variant='outline'>
            <Link href='/my-tasks' aria-label='View all assigned tasks'>
              See all
            </Link>
          </Button>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {items.length ? <TaskList items={items} /> : <EmptyState />}
      </div>
    </section>
  )
}

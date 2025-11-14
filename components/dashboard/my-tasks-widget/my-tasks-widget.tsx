'use client'

import type { UserRole } from '@/lib/auth/session'
import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { cn } from '@/lib/utils'
import { useMyTasksWidgetState } from '@/lib/projects/tasks/use-my-tasks-widget-state'

import { EmptyState } from './empty-state'
import { TaskList } from './task-list'

type MyTasksWidgetProps = {
  tasks: AssignedTaskSummary[]
  role: UserRole
  userId: string
  className?: string
}

export function MyTasksWidget({
  tasks,
  role,
  userId,
  className,
}: MyTasksWidgetProps) {
  const description =
    role === 'CLIENT'
      ? 'Tasks you are assigned to across your projects.'
      : 'Assigned work from every active project.'

  const { items } = useMyTasksWidgetState({
    initialTasks: tasks,
  })

  return (
    <section
      className={cn(
        'bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='my-tasks-heading'
    >
      <header className='flex items-start justify-between gap-3 border-b px-5 py-4'>
        <div>
          <h2 id='my-tasks-heading' className='text-base font-semibold'>
            My Tasks
          </h2>
          <p className='text-muted-foreground text-xs'>{description}</p>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {items.length ? <TaskList items={items} /> : <EmptyState />}
      </div>
    </section>
  )
}

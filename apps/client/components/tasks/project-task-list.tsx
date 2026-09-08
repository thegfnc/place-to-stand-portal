import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getTaskStatusLabel, getTaskStatusToken } from '@/lib/tasks/task-status'
import type { ClientTask, ProjectTasks } from '@/lib/data/tasks'

/**
 * Task rows with no surface of their own.
 *
 * Shared by the project page (inside a bordered card) and the dashboard's
 * expandable project rows, so both render the same work identically.
 */
function TaskRows({ tasks }: { tasks: ClientTask[] }) {
  return (
    <ul className="divide-y divide-border">
      {tasks.map(task => (
        <li key={task.id} className="flex items-start justify-between gap-3 py-2.5">
          <span className="min-w-0 text-sm text-card-foreground">
            {task.title}
          </span>
          <Badge
            variant="secondary"
            className={cn('shrink-0', getTaskStatusToken(task.status))}
          >
            {getTaskStatusLabel(task.status)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function ProjectTaskList({ tasks }: { tasks: ProjectTasks }) {
  const hasAny = tasks.current.length > 0 || tasks.completed.length > 0

  if (!hasAny) {
    return (
      <section className="space-y-2">
        <SectionLabel>Tasks</SectionLabel>
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Your account manager will add them as work is planned.
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {tasks.current.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>In Progress</SectionLabel>
          <TaskGroup tasks={tasks.current} />
        </section>
      )}

      {tasks.completed.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Completed</SectionLabel>
          <TaskGroup tasks={tasks.completed} />
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function TaskGroup({ tasks }: { tasks: ClientTask[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card px-4">
      <TaskRows tasks={tasks} />
    </div>
  )
}

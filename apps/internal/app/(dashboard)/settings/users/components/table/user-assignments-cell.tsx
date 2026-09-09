'use client'

import type { ReactNode } from 'react'
import {
  Building2,
  FolderKanban,
  ListTodo,
  type LucideIcon,
} from 'lucide-react'

import {
  LinkedRecordsHoverCell,
  useCoordinatedHoverCards,
} from '@/components/ui/linked-records-hover-cell'
import { BOARD_VIEW_SEGMENTS } from '@/lib/projects/board/board-constants'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import type {
  UserAssignedProject,
  UserAssignmentSummary,
} from '@/lib/queries/users/assignments'
import { cn } from '@/lib/utils'

const EMPTY_SUMMARY: UserAssignmentSummary = {
  clients: 0,
  projects: 0,
  tasks: 0,
  clientList: [],
  projectList: [],
}

/**
 * Same segment rules as `getProjectClientSegment` (board-utils) without the
 * lookup maps: internal/personal projects use their reserved segment, client
 * projects use the client slug. No slug means no canonical route, so the row
 * renders as plain text.
 */
function projectTasksHref(project: UserAssignedProject): string | undefined {
  if (!project.slug) return undefined
  const clientSegment =
    project.type === 'INTERNAL'
      ? PROJECT_SPECIAL_SEGMENTS.INTERNAL
      : project.type === 'PERSONAL'
        ? PROJECT_SPECIAL_SEGMENTS.PERSONAL
        : project.clientSlug
  if (!clientSegment) return undefined
  return `/projects/${clientSegment}/${project.slug}/${BOARD_VIEW_SEGMENTS.board}`
}

function AssignmentPair({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <span className='flex items-center gap-1' title={title}>
      <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
      {children}
    </span>
  )
}

type UserAssignmentsCellProps = {
  assignment: UserAssignmentSummary | undefined
}

/**
 * Icon + count per assignment kind. Clients and projects open a hover list
 * (coordinated so sliding between them never shows both); tasks is a plain
 * count — there is no per-user task list to link into from here.
 */
export function UserAssignmentsCell({ assignment }: UserAssignmentsCellProps) {
  const summary = assignment ?? EMPTY_SUMMARY
  const bind = useCoordinatedHoverCards<'clients' | 'projects'>()

  return (
    <div className='flex items-center gap-3 text-sm'>
      <AssignmentPair icon={Building2} title='Clients'>
        <LinkedRecordsHoverCell
          count={summary.clients}
          icon={Building2}
          ariaLabel={`${summary.clients} ${summary.clients === 1 ? 'client' : 'clients'}`}
          triggerClassName='text-muted-foreground'
          items={summary.clientList.map(client => ({
            id: client.id,
            label: client.name,
            href: `/clients/${client.slug ?? client.id}`,
          }))}
          {...bind('clients')}
        />
      </AssignmentPair>
      <AssignmentPair icon={FolderKanban} title='Projects'>
        <LinkedRecordsHoverCell
          count={summary.projects}
          icon={FolderKanban}
          ariaLabel={`${summary.projects} ${summary.projects === 1 ? 'project' : 'projects'}`}
          triggerClassName='text-muted-foreground'
          items={summary.projectList.map(project => ({
            id: project.id,
            label: project.name,
            href: projectTasksHref(project),
          }))}
          {...bind('projects')}
        />
      </AssignmentPair>
      <AssignmentPair icon={ListTodo} title='Tasks'>
        <span
          className={cn(
            summary.tasks === 0
              ? 'text-muted-foreground/50'
              : 'text-muted-foreground'
          )}
          aria-label={`${summary.tasks} ${summary.tasks === 1 ? 'task' : 'tasks'}`}
        >
          {summary.tasks}
        </span>
      </AssignmentPair>
    </div>
  )
}

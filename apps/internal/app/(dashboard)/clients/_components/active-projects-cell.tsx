'use client'

import { FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  LinkedRecordsHoverCell,
  useCoordinatedHoverCards,
} from '@/components/ui/linked-records-hover-cell'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import type { ClientProjectSummary } from '@/lib/data/clients'
import { cn } from '@/lib/utils'

type ActiveProjectsCellProps = {
  projects: ClientProjectSummary[]
  allProjects: ClientProjectSummary[]
  clientSlug: string | null
  clientId: string
  totalProjectCount: number
}

export function ActiveProjectsCell({
  projects,
  allProjects,
  clientSlug,
  clientId,
  totalProjectCount,
}: ActiveProjectsCellProps) {
  const activeCount = projects.length

  // Build base path for project links
  const clientPath = clientSlug ?? clientId
  const projectHref = (project: ClientProjectSummary) =>
    `/projects/${clientPath}/${project.slug ?? project.id}/tasks`

  // Coordinated hovers (W8/R8): the active and total cards sit side by side,
  // so opening one must force-close the other.
  const bind = useCoordinatedHoverCards<'active' | 'total'>()

  const totalHover = (tone: string) => (
    <LinkedRecordsHoverCell
      count={totalProjectCount}
      triggerLabel={`(${totalProjectCount} total)`}
      icon={FolderKanban}
      triggerClassName={tone}
      contentClassName='min-w-64'
      items={allProjects.map(project => ({
        id: project.id,
        label: project.name,
        href: projectHref(project),
        trailing: (
          <Badge
            variant='outline'
            className={cn('text-xs', getProjectStatusToken(project.status))}
          >
            {getProjectStatusLabel(project.status)}
          </Badge>
        ),
      }))}
      {...bind('total')}
    />
  )

  return (
    <div className='flex items-center gap-2 text-sm'>
      <FolderKanban className='text-muted-foreground h-4 w-4' />
      <LinkedRecordsHoverCell
        count={activeCount}
        label=' active'
        icon={FolderKanban}
        triggerClassName='text-muted-foreground'
        items={projects.map(project => ({
          id: project.id,
          label: project.name,
          href: projectHref(project),
        }))}
        {...bind('active')}
      />
      {/* The total card only earns its place when it adds projects the
          active list doesn't show; it dims further next to a zero. */}
      {totalProjectCount > activeCount &&
        totalHover(
          activeCount === 0
            ? 'text-muted-foreground/50'
            : 'text-muted-foreground/60'
        )}
    </div>
  )
}

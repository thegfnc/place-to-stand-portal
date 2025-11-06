'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Building2, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { buildBoardPath } from '@/lib/projects/board/board-utils'
import {
  createProjectLookup,
  createProjectsByClientLookup,
  createClientSlugLookup,
} from '@/lib/projects/board/board-utils'
import type { ProjectWithRelations } from '@/lib/types'
import { cn } from '@/lib/utils'

type ProjectsLandingProps = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
}

export function ProjectsLanding({ projects, clients }: ProjectsLandingProps) {
  const projectsByClient = useMemo(() => {
    const map = new Map<
      string,
      {
        client: { id: string; name: string; slug: string | null }
        projects: ProjectWithRelations[]
      }
    >()

    projects.forEach(project => {
      if (!project.client_id || !project.client) {
        return
      }

      const existing = map.get(project.client_id)
      if (existing) {
        existing.projects.push(project)
      } else {
        map.set(project.client_id, {
          client: {
            id: project.client.id,
            name: project.client.name,
            slug: project.client.slug,
          },
          projects: [project],
        })
      }
    })

    // Sort projects within each client
    map.forEach(entry => {
      entry.projects.sort((a, b) => a.name.localeCompare(b.name))
    })

    // Convert to array and sort by client name
    return Array.from(map.values()).sort((a, b) =>
      a.client.name.localeCompare(b.client.name)
    )
  }, [projects])

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const getProjectHref = (project: ProjectWithRelations) => {
    const path = buildBoardPath(
      project.id,
      {
        projectLookup,
        projectsByClientId,
        clientSlugLookup,
      },
      { view: 'board' }
    )
    return path ?? '#'
  }

  if (projectsByClient.length === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No projects found</h2>
          <p className='text-muted-foreground text-sm'>
            Projects will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {projectsByClient.map(({ client, projects: clientProjects }) => (
        <div key={client.id} className='space-y-4'>
          <div className='flex items-center gap-2'>
            <Building2 className='text-muted-foreground h-5 w-5' />
            <h2 className='text-xl font-semibold'>{client.name}</h2>
            <Badge variant='secondary' className='ml-2'>
              {clientProjects.length}
            </Badge>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {clientProjects.map(project => {
              const href = getProjectHref(project)
              const statusLabel = getProjectStatusLabel(project.status)
              const statusToken = getProjectStatusToken(project.status)
              const dateRange = formatProjectDateRange(
                project.starts_on,
                project.ends_on
              )

              // Calculate task counts by status
              // Tasks are already filtered at query level to exclude deleted tasks
              const backlogCount = project.tasks.filter(
                task => task.status === 'BACKLOG'
              ).length
              const doneCount = project.tasks.filter(
                task => task.status === 'DONE'
              ).length
              const inProgressCount = project.tasks.filter(
                task => task.status !== 'BACKLOG' && task.status !== 'DONE'
              ).length

              return (
                <Link key={project.id} href={href}>
                  <Card className='flex h-full cursor-pointer flex-col justify-between transition hover:shadow-md'>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex min-w-0 flex-1 items-center gap-2'>
                          <FolderKanban className='text-muted-foreground mt-0.5 h-5 w-5 shrink-0' />
                          <CardTitle className='line-clamp-2'>
                            {project.name}
                          </CardTitle>
                        </div>
                        <Badge className={cn('text-xs', statusToken)}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <CardDescription className='flex items-center gap-2'>
                        {dateRange !== '—' ? (
                          <div className='text-muted-foreground text-sm'>
                            {dateRange}
                          </div>
                        ) : null}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className='text-muted-foreground flex gap-4 text-xs'>
                        <li className='flex items-center gap-1'>
                          <strong>{backlogCount}</strong> Backlog
                        </li>
                        <li className='flex items-center gap-1'>
                          <strong>{inProgressCount}</strong> In Progress
                        </li>
                        <li className='flex items-center gap-1'>
                          <strong>{doneCount}</strong> Done
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { FolderKanban, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

type ClientProjectSection = {
  client: { id: string; name: string; slug: string | null }
  projects: ProjectWithRelations[]
}

type ProjectsLandingProps = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
}

type SectionConfig = {
  key: 'client' | 'internal' | 'personal'
  title: string
  icon: LucideIcon
  count: number
  content: ReactNode
}

export function ProjectsLanding({
  projects,
  clients,
  currentUserId,
}: ProjectsLandingProps) {
  const { clientSections, internalProjects, personalProjects } = useMemo(() => {
    const clientMap = new Map<string, ClientProjectSection>()
    const internal: ProjectWithRelations[] = []
    const personal: ProjectWithRelations[] = []

    projects.forEach(project => {
      if (project.type === 'INTERNAL') {
        internal.push(project)
        return
      }

      if (project.type === 'PERSONAL') {
        if (project.created_by === currentUserId) {
          personal.push(project)
        }
        return
      }

      if (!project.client_id || !project.client) {
        return
      }

      const existing = clientMap.get(project.client_id)
      if (existing) {
        existing.projects.push(project)
      } else {
        clientMap.set(project.client_id, {
          client: {
            id: project.client.id,
            name: project.client.name,
            slug: project.client.slug,
          },
          projects: [project],
        })
      }
    })

    clientMap.forEach(entry => {
      entry.projects.sort((a, b) => a.name.localeCompare(b.name))
    })

    internal.sort((a, b) => a.name.localeCompare(b.name))
    personal.sort((a, b) => a.name.localeCompare(b.name))

    const sortedClientSections = Array.from(clientMap.values()).sort((a, b) =>
      a.client.name.localeCompare(b.client.name)
    )

    return {
      clientSections: sortedClientSections,
      internalProjects: internal,
      personalProjects: personal,
    }
  }, [projects, currentUserId])

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

  const clientProjectCount = clientSections.reduce(
    (total, section) => total + section.projects.length,
    0
  )
  const totalProjects =
    clientProjectCount + internalProjects.length + personalProjects.length

  if (totalProjects === 0) {
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

  const renderSectionEmptyState = (message: string) => (
    <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
      {message}
    </div>
  )

  const renderProjectRow = (project: ProjectWithRelations) => {
    const href = getProjectHref(project)
    const statusLabel = getProjectStatusLabel(project.status)
    const statusToken = getProjectStatusToken(project.status)
    const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

    const activeTasks = project.tasks.filter(task => task.status !== 'ARCHIVED')
    const doneCount = activeTasks.filter(task => task.status === 'DONE').length
    const totalCount = activeTasks.length
    const progressPercentage =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    return (
      <TableRow key={project.id}>
        <TableCell>
          <Link href={href} className='flex items-center gap-2 py-1 hover:underline'>
            <FolderKanban className='h-4 w-4 shrink-0 text-emerald-500' />
            <span className='font-medium'>{project.name}</span>
          </Link>
        </TableCell>
        <TableCell>
          <Badge className={cn('text-xs', statusToken)}>{statusLabel}</Badge>
        </TableCell>
        <TableCell className='w-[200px]'>
          <div className='flex items-center gap-3'>
            <Progress value={progressPercentage} className='h-2 w-24' />
            <span className='text-muted-foreground text-xs'>
              {doneCount}/{totalCount}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <span className='text-muted-foreground text-sm'>
            {dateRange !== '—' ? dateRange : '—'}
          </span>
        </TableCell>
      </TableRow>
    )
  }

  const renderProjectTable = (items: ProjectWithRelations[]) => (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='w-[300px]'>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Dates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{items.map(project => renderProjectRow(project))}</TableBody>
      </Table>
    </div>
  )

  const clientSectionContent =
    clientSections.length > 0 ? (
      <div className='mb-10 space-y-10'>
        {clientSections.map(({ client, projects: clientProjects }) => (
          <div key={client.id} className='space-y-4'>
            <div className='flex items-center gap-2'>
              <h3 className='text-base font-semibold'>
                <Link
                  href={
                    client.slug
                      ? `/clients/${client.slug}`
                      : `/clients/${client.id}`
                  }
                  className='underline-offset-4 hover:underline'
                >
                  {client.name}
                </Link>
              </h3>
            </div>
            {renderProjectTable(clientProjects)}
          </div>
        ))}
      </div>
    ) : (
      renderSectionEmptyState(
        'Client projects will appear here once they are created.'
      )
    )

  const sectionConfigs: (SectionConfig & { className?: string })[] = [
    {
      key: 'internal',
      title: 'Internal Projects',
      icon: Users,
      count: internalProjects.length,
      content:
        internalProjects.length > 0
          ? renderProjectTable(internalProjects)
          : renderSectionEmptyState('There are no internal projects yet.'),
    },
    {
      key: 'personal',
      title: 'Personal Projects',
      icon: UserRound,
      count: personalProjects.length,
      content:
        personalProjects.length > 0
          ? renderProjectTable(personalProjects)
          : renderSectionEmptyState(
              'You have not created any personal projects yet.'
            ),
    },
  ]

  return (
    <div className='mb-14 space-y-24'>
      <div>{clientSectionContent}</div>
      {sectionConfigs.map(
        ({ key, title, icon: Icon, count, content, className }) => (
          <div key={key} className={cn('space-y-6', className)}>
            <div className='flex items-center gap-3 border-b pb-4'>
              <div className='bg-background flex h-10 w-10 items-center justify-center rounded-md border shadow-sm'>
                <Icon className='text-muted-foreground h-5 w-5' />
              </div>
              <div>
                <h2 className='text-xl font-semibold tracking-tight'>
                  {title}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {count} project{count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div>{content}</div>
          </div>
        )
      )}
    </div>
  )
}

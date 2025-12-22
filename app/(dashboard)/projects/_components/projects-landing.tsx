'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Building2, FolderKanban, UserRound, Users } from 'lucide-react'
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

  const renderProjectRow = (
    project: ProjectWithRelations,
    options?: { indent?: boolean; isLast?: boolean }
  ) => {
    const href = getProjectHref(project)
    const statusLabel = getProjectStatusLabel(project.status)
    const statusToken = getProjectStatusToken(project.status)
    const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

    const activeTasks = project.tasks.filter(task => task.status !== 'ARCHIVED')
    const doneCount = activeTasks.filter(task => task.status === 'DONE').length
    const totalCount = activeTasks.length
    const progressPercentage =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    const treeLine = options?.indent ? (options.isLast ? '└' : '├') : null

    return (
      <TableRow key={project.id}>
        <TableCell>
          <div className='flex items-center'>
            {treeLine && (
              <span className='text-muted-foreground/30 mr-2 w-4 shrink-0 text-center font-mono'>
                {treeLine}
              </span>
            )}
            <Link
              href={href}
              className='flex items-center gap-2 py-1 hover:underline'
            >
              <FolderKanban className='h-4 w-4 shrink-0 text-emerald-500' />
              <span className='font-medium'>{project.name}</span>
            </Link>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={cn('text-xs', statusToken)}>{statusLabel}</Badge>
        </TableCell>
        <TableCell>
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

  const tableColumnWidths = {
    project: 'w-[40%]',
    status: 'w-[15%]',
    progress: 'w-[25%]',
    dates: 'w-[20%]',
  }

  const renderProjectTable = (items: ProjectWithRelations[]) => (
    <div className='rounded-lg border'>
      <Table className='table-fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className={tableColumnWidths.project}>Project</TableHead>
            <TableHead className={tableColumnWidths.status}>Status</TableHead>
            <TableHead className={tableColumnWidths.progress}>
              Progress
            </TableHead>
            <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{items.map(project => renderProjectRow(project))}</TableBody>
      </Table>
    </div>
  )

  const renderClientSeparatorRow = (client: {
    id: string
    name: string
    slug: string | null
  }) => (
    <TableRow
      key={`client-${client.id}`}
      className='border-t-muted hover:bg-transparent'
    >
      <TableCell
        colSpan={4}
        className='bg-blue-100 pt-3 pb-2.5 align-middle dark:bg-blue-500/5'
      >
        <Link
          href={
            client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
          }
          className='inline-flex items-center gap-2 underline-offset-4 opacity-65 hover:underline'
        >
          <Building2 className='h-4 w-4 shrink-0 text-blue-500/75' />
          <span className='text-sm font-semibold'>{client.name}</span>
        </Link>
      </TableCell>
    </TableRow>
  )

  const clientSectionContent =
    clientSections.length > 0 ? (
      <div className='rounded-lg border'>
        <Table className='table-fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className={tableColumnWidths.project}>
                Project
              </TableHead>
              <TableHead className={tableColumnWidths.status}>Status</TableHead>
              <TableHead className={tableColumnWidths.progress}>
                Progress
              </TableHead>
              <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientSections.flatMap(({ client, projects: clientProjects }) => [
              renderClientSeparatorRow(client),
              ...clientProjects.map((project, index) =>
                renderProjectRow(project, {
                  indent: true,
                  isLast: index === clientProjects.length - 1,
                })
              ),
            ])}
          </TableBody>
        </Table>
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
    <div className='space-y-12'>
      <div>{clientSectionContent}</div>
      {sectionConfigs.map(
        ({ key, title, icon: Icon, count, content, className }) => (
          <div key={key} className={cn('space-y-4', className)}>
            <div className='flex items-center gap-2'>
              <div className='bg-accent flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
                <Icon className='text-muted-foreground h-4 w-4' />
              </div>
              <h2 className='text-base font-semibold'>{title}</h2>
              <span className='text-muted-foreground text-sm'>({count})</span>
            </div>
            <div>{content}</div>
          </div>
        )
      )}
    </div>
  )
}

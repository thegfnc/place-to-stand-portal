'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Building2, FolderKanban, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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

  const renderProjectCard = (project: ProjectWithRelations) => {
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
      <Link key={project.id} href={href}>
        <Card className='border-card-foreground/20 hover:border-card-foreground/40 flex h-full cursor-pointer flex-col justify-between transition hover:shadow-md'>
          <CardHeader>
            <div className='flex items-start justify-between gap-2'>
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <FolderKanban className='text-muted-foreground mt-0.5 h-5 w-5 shrink-0' />
                <CardTitle className='line-clamp-2'>{project.name}</CardTitle>
              </div>
              <Badge className={cn('text-xs', statusToken)}>
                {statusLabel}
              </Badge>
            </div>
            <CardDescription className='flex items-center gap-2'>
              {dateRange !== '—' ? (
                <div className='text-muted-foreground text-sm'>{dateRange}</div>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Task Progress</span>
                <span className='text-muted-foreground font-medium'>
                  {doneCount} of {totalCount} done
                </span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  const renderProjectGrid = (items: ProjectWithRelations[]) => (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {items.map(project => renderProjectCard(project))}
    </div>
  )

  const clientSectionContent =
    clientSections.length > 0 ? (
      <div className='space-y-10'>
        {clientSections.map(({ client, projects: clientProjects }) => (
          <div key={client.id} className='space-y-4'>
            <div className='flex items-center gap-2'>
              <h3 className='text-sm font-semibold'>{client.name}</h3>
            </div>
            {renderProjectGrid(clientProjects)}
          </div>
        ))}
      </div>
    ) : (
      renderSectionEmptyState(
        'Client projects will appear here once they are created.'
      )
    )

  const sectionConfigs: SectionConfig[] = [
    {
      key: 'client',
      title: 'Client Projects',
      icon: Building2,
      count: clientProjectCount,
      content: clientSectionContent,
    },
    {
      key: 'internal',
      title: 'Internal Projects',
      icon: Users,
      count: internalProjects.length,
      content:
        internalProjects.length > 0
          ? renderProjectGrid(internalProjects)
          : renderSectionEmptyState('There are no internal projects yet.'),
    },
    {
      key: 'personal',
      title: 'Personal Projects',
      icon: UserRound,
      count: personalProjects.length,
      content:
        personalProjects.length > 0
          ? renderProjectGrid(personalProjects)
          : renderSectionEmptyState(
              'You have not created any personal projects yet.'
            ),
    },
  ]

  return (
    <div className='space-y-10 pb-10'>
      {sectionConfigs.map(({ key, title, icon: Icon, count, content }) => (
        <section
          key={key}
          className='bg-card/50 text-card-foreground overflow-hidden rounded-xl border shadow-sm'
        >
          <div className='bg-muted flex items-center gap-3 border-b px-6 py-4'>
            <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
              <Icon className='text-muted-foreground h-4 w-4' />
            </div>
            <h2 className='text-lg font-semibold tracking-tight'>{title}</h2>
            <Badge variant='secondary' className='border-border'>
              {count}
            </Badge>
          </div>
          <div className='mb-6 p-6'>{content}</div>
        </section>
      ))}
    </div>
  )
}

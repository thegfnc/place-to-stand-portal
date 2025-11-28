'use client'

import Link from 'next/link'
import { Building2, Calendar, FolderKanban } from 'lucide-react'
import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'
import { cn } from '@/lib/utils'
import type {
  ClientDetail as ClientDetailType,
  ClientProject,
} from '@/lib/data/clients'

import { ClientNotesSection } from './client-notes-section'

type ClientDetailProps = {
  client: ClientDetailType
  projects: ClientProject[]
}

export function ClientDetail({ client, projects }: ClientDetailProps) {
  const activeProjects = projects.filter(
    p => p.status.toLowerCase() === 'active'
  )
  const otherProjects = projects.filter(
    p => p.status.toLowerCase() !== 'active'
  )

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='overview' className='w-full'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-6 space-y-8'>
          {/* Client Info Card */}
          <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
            <div className='bg-muted/30 flex items-center gap-3 border-b px-6 py-4'>
              <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
                <Building2 className='text-muted-foreground h-4 w-4' />
              </div>
              <h2 className='text-lg font-semibold tracking-tight'>
                {client.name}
              </h2>
            </div>
            <div className='grid gap-6 p-6 md:grid-cols-4'>
              <div className='flex flex-col gap-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Billing Type
                </p>
                <Badge variant='outline'>
                  {getBillingTypeLabel(client.billingType)}
                </Badge>
              </div>
              <div className='flex flex-col gap-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Projects
                </p>
                <p className='text-foreground text-sm'>
                  {activeProjects.length} active
                  {otherProjects.length > 0
                    ? `, ${otherProjects.length} other`
                    : ''}
                </p>
              </div>
              {client.slug ? (
                <div className='flex flex-col gap-2'>
                  <p className='text-muted-foreground text-sm font-medium'>
                    Slug
                  </p>
                  <p className='text-foreground font-mono text-sm'>
                    {client.slug}
                  </p>
                </div>
              ) : null}
              <div className='flex flex-col gap-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Created
                </p>
                <p className='text-foreground text-sm'>
                  {format(new Date(client.createdAt), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
            <div className='bg-muted/30 flex items-center gap-3 border-b px-6 py-4'>
              <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
                <FolderKanban className='text-muted-foreground h-4 w-4' />
              </div>
              <h2 className='text-lg font-semibold tracking-tight'>Projects</h2>
              <Badge variant='secondary'>{projects.length}</Badge>
            </div>
            <div className='p-6'>
              {projects.length === 0 ? (
                <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
                  No projects found for this client.
                </div>
              ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {projects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      clientSlug={client.slug}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Notes Section */}
          <ClientNotesSection
            clientId={client.id}
            initialNotes={client.notes}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type ProjectCardProps = {
  project: ClientProject
  clientSlug: string | null
}

function ProjectCard({ project, clientSlug }: ProjectCardProps) {
  const statusLabel = getProjectStatusLabel(project.status)
  const statusToken = getProjectStatusToken(project.status)
  const dateRange = formatProjectDateRange(project.startsOn, project.endsOn)
  const progressPercentage =
    project.totalTasks > 0
      ? Math.round((project.doneTasks / project.totalTasks) * 100)
      : 0

  // Build the project board URL
  const projectSlug = project.slug ?? project.id
  const clientPath = clientSlug ?? project.id
  const href = `/projects/${clientPath}/${projectSlug}/board`

  return (
    <Link href={href}>
      <Card className='border-card-foreground/20 hover:border-card-foreground/40 flex h-full cursor-pointer flex-col justify-between transition hover:shadow-md'>
        <CardHeader>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex min-w-0 flex-1 items-center gap-2'>
              <FolderKanban className='text-muted-foreground mt-0.5 h-5 w-5 shrink-0' />
              <CardTitle className='line-clamp-2'>{project.name}</CardTitle>
            </div>
            <Badge className={cn('text-xs', statusToken)}>{statusLabel}</Badge>
          </div>
          <CardDescription className='flex items-center gap-2'>
            {dateRange !== '—' ? (
              <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                <Calendar className='h-3 w-3' />
                {dateRange}
              </div>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-xs'>
              <span className='text-muted-foreground'>Task Progress</span>
              <span className='text-muted-foreground font-medium'>
                {project.doneTasks} of {project.totalTasks} done
              </span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

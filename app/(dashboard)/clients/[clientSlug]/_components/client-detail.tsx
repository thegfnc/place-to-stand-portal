'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, Building2, Calendar, FolderKanban, Pencil } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { softDeleteClient } from '@/app/(dashboard)/clients/actions'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import type {
  ClientDetail as ClientDetailType,
  ClientProject,
} from '@/lib/data/clients'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'
import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  PENDING_REASON,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'
import type {
  ClientRow,
  ClientUserSummary,
} from '@/lib/settings/clients/client-sheet-utils'
import { cn } from '@/lib/utils'

import { ClientSheet } from '../../_components/clients-sheet'
import { ClientNotesSection } from './client-notes-section'

type HydratedClientDetail = ClientDetailType & { resolvedId: string }

type ClientDetailProps = {
  client: HydratedClientDetail
  projects: ClientProject[]
  canManageClients: boolean
  clientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
  clientRow: ClientRow
}

export function ClientDetail({
  client,
  projects,
  canManageClients,
  clientUsers,
  clientMembers,
  clientRow,
}: ClientDetailProps) {
  const activeProjects = projects.filter(
    p => p.status.toLowerCase() === 'active'
  )
  const otherProjects = projects.filter(
    p => p.status.toLowerCase() !== 'active'
  )

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='overview' className='w-full'>
        <div className='flex flex-wrap items-center gap-4'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
          </TabsList>
          {canManageClients ? (
            <ClientOverviewActions
              client={client}
              clientRow={clientRow}
              clientUsers={clientUsers}
              clientMembers={clientMembers}
            />
          ) : null}
        </div>

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

type ClientOverviewActionsProps = {
  client: HydratedClientDetail
  clientRow: ClientRow
  clientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
}

function ClientOverviewActions({
  client,
  clientRow,
  clientUsers,
  clientMembers,
}: ClientOverviewActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSheetComplete = () => {
    setSheetOpen(false)
    router.refresh()
  }

  const handleSheetArchived = () => {
    router.push('/clients')
    router.refresh()
  }

  const handleConfirmArchive = () => {
    startTransition(async () => {
      const result = await softDeleteClient({ id: clientRow.id })

      if (result.error) {
        toast({
          title: 'Unable to archive client',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Client archived',
        description: `${client.name} is hidden from selectors but history remains accessible.`,
      })
      setConfirmOpen(false)
      router.push('/clients')
      router.refresh()
    })
  }

  const disabledReason = isPending ? PENDING_REASON : null

  return (
    <>
      <div className='flex flex-wrap items-center gap-2 ml-auto'>
        <DisabledFieldTooltip disabled={isPending} reason={disabledReason}>
          <Button
            type='button'
            variant='outline'
            onClick={() => setSheetOpen(true)}
            disabled={isPending}
            aria-label='Edit client'
            title='Edit client'
          >
            <Pencil className='h-4 w-4' />
            Edit client
          </Button>
        </DisabledFieldTooltip>
      </div>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleSheetComplete}
        onArchived={handleSheetArchived}
        client={clientRow}
        allClientUsers={clientUsers}
        clientMembers={clientMembers}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={ARCHIVE_CLIENT_DIALOG_TITLE}
        description={getArchiveClientDialogDescription(client.name)}
        confirmLabel={ARCHIVE_CLIENT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmArchive}
      />
    </>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Building2,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Trash,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import {
  destroyProject,
  restoreProject,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  getStatusBadgeToken,
} from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { cn } from '@/lib/utils'

import type { ProjectWithClient, ProjectsSettingsTableProps } from './types'

type ProjectsTab = 'projects' | 'archive' | 'activity'

const ProjectsActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

function useProjectBuckets(projects: ProjectWithClient[]) {
  return useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )

    const active = sorted.filter(project => !project.deleted_at)
    const archived = sorted.filter(project => Boolean(project.deleted_at))

    return { active, archived }
  }, [projects])
}

function useSortedClients(
  clients: ProjectsSettingsTableProps['clients']
): ProjectsSettingsTableProps['clients'] {
  return useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )
}

export function ProjectsSettingsTable(props: ProjectsSettingsTableProps) {
  const { projects, clients, contractorUsers, membersByProject } = props
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedProject, setSelectedProject] =
    useState<ProjectWithClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<ProjectWithClient | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ProjectsTab>('projects')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const { active: activeProjects, archived: archivedProjects } =
    useProjectBuckets(projects)
  const sortedClients = useSortedClients(clients)

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null
  const pendingReason = 'Please wait for the current request to finish.'

  const openCreate = () => {
    setSelectedProject(null)
    setSheetOpen(true)
  }

  const openEdit = (project: ProjectWithClient) => {
    setSelectedProject(project)
    setSheetOpen(true)
  }

  const handleClosed = () => {
    setSheetOpen(false)
    setSelectedProject(null)
    router.refresh()
  }

  const handleRequestDelete = (project: ProjectWithClient) => {
    if (project.deleted_at || isPending) {
      return
    }

    setDeleteTarget(project)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const project = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(project.id)

    startTransition(async () => {
      try {
        const result = await softDeleteProject({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to delete project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project archived',
          description: `${project.name} is hidden from active views but remains in historical reporting.`,
        })
        router.refresh()
        setActiveTab('archive')
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (project: ProjectWithClient) => {
    if (!project.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(project.id)
    startTransition(async () => {
      try {
        const result = await restoreProject({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to restore project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project restored',
          description: `${project.name} is active again.`,
        })
        router.refresh()
        setActiveTab('projects')
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (project: ProjectWithClient) => {
    if (!project.deleted_at || isPending) {
      return
    }

    setDestroyTarget(project)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const project = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(project.id)

    startTransition(async () => {
      try {
        const result = await destroyProject({ id: project.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Project permanently deleted',
          description: `${project.name} has been removed.`,
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive project?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from active views but keeps the history intact.`
            : 'Archiving this project hides it from active views but keeps the history intact.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete project?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this project and its memberships. This action cannot be undone.`
            : 'Permanently deleting this project removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as ProjectsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='projects'>Projects</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {activeTab === 'projects' ? (
            <DisabledFieldTooltip
              disabled={createDisabled}
              reason={createDisabledReason}
            >
              <Button onClick={openCreate} disabled={createDisabled}>
                <Plus className='h-4 w-4' /> Add project
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
        <TabsContent value='projects' className='space-y-6'>
          <ProjectsTableSection
            projects={activeProjects}
            mode='active'
            onEdit={openEdit}
            onRequestDelete={handleRequestDelete}
            onRestore={handleRestore}
            onRequestDestroy={handleRequestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No projects yet. Create one to begin tracking work.'
          />
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          <ProjectsTableSection
            projects={archivedProjects}
            mode='archive'
            onEdit={openEdit}
            onRequestDelete={handleRequestDelete}
            onRestore={handleRestore}
            onRequestDestroy={handleRequestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No archived projects. Archived projects appear here after deletion.'
          />
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Audit project creation, edits, archives, and deletions in one
                place.
              </p>
            </div>
            <ProjectsActivityFeed
              targetType='PROJECT'
              pageSize={20}
              emptyState='No recent project activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={open => {
          setSheetOpen(open)
          if (!open) {
            setSelectedProject(null)
          }
        }}
        onComplete={handleClosed}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
    </div>
  )
}

type ProjectsTableSectionProps = {
  projects: ProjectWithClient[]
  mode: 'active' | 'archive'
  onEdit: (project: ProjectWithClient) => void
  onRequestDelete: (project: ProjectWithClient) => void
  onRestore: (project: ProjectWithClient) => void
  onRequestDestroy: (project: ProjectWithClient) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
}

function ProjectsTableSection({
  projects,
  mode,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ProjectsTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(project => {
            const client = project.client
            const isDeleting = isPending && pendingDeleteId === project.id
            const isRestoring = isPending && pendingRestoreId === project.id
            const isDestroying = isPending && pendingDestroyId === project.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(project.deleted_at)
            const deleteDisabledReason = deleteDisabled
              ? project.deleted_at
                ? 'Project already archived.'
                : pendingReason
              : null

            const restoreDisabled =
              isRestoring || isDeleting || isDestroying || !project.deleted_at
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !project.deleted_at
            const destroyDisabledReason = destroyDisabled
              ? !project.deleted_at
                ? 'Archive the project before permanently deleting.'
                : pendingReason
              : null

            const editDisabled = isDeleting || isRestoring || isDestroying
            const editDisabledReason = editDisabled ? pendingReason : null

            const showEdit = mode === 'active'
            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            const isArchived = Boolean(project.deleted_at)

            const statusLabel = isArchived
              ? 'Archived'
              : getProjectStatusLabel(project.status)
            const statusTone = isArchived
              ? getStatusBadgeToken('archived')
              : getProjectStatusToken(project.status)

            return (
              <TableRow
                key={project.id}
                className={isArchived ? 'opacity-60' : undefined}
              >
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <FolderKanban className='text-muted-foreground h-4 w-4' />
                    <span className='font-medium'>{project.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    <span>{client ? client.name : 'Unassigned'}</span>
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-xs', statusTone)}>
                    {statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {formatProjectDateRange(project.starts_on, project.ends_on)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showEdit ? (
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(project)}
                          title='Edit project'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='secondary'
                          size='icon'
                          onClick={() => onRestore(project)}
                          title='Restore project'
                          aria-label='Restore project'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showArchive ? (
                      <DisabledFieldTooltip
                        disabled={deleteDisabled}
                        reason={deleteDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDelete(project)}
                          title='Archive project'
                          aria-label='Archive project'
                          disabled={deleteDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDestroy(project)}
                          title='Permanently delete project'
                          aria-label='Permanently delete project'
                          disabled={destroyDisabled}
                        >
                          <Trash className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {projects.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

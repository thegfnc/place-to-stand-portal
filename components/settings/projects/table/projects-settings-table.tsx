'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { softDeleteProject } from '@/app/(dashboard)/settings/projects/actions'

import type { ProjectWithClient, ProjectsSettingsTableProps } from './types'
import { ProjectsSettingsTableRow } from './projects-settings-table-row'

function useSortedProjects(projects: ProjectWithClient[]) {
  return useMemo(
    () =>
      projects
        .filter(project => !project.deleted_at)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        ),
    [projects]
  )
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithClient | null>(
    null
  )
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const sortedProjects = useSortedProjects(projects)
  const sortedClients = useSortedClients(clients)

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null

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
          title: 'Project deleted',
          description: `${project.name} is hidden from active views but remains in historical reporting.`,
        })
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Projects</h2>
          <p className='text-muted-foreground text-sm'>
            Review active projects with quick insight into timing and client.
          </p>
        </div>
        {createDisabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className='ml-auto'
                onClick={openCreate}
                disabled={createDisabled}
              >
                <Plus className='h-4 w-4' /> Add project
              </Button>
            </TooltipTrigger>
            <TooltipContent>{createDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            className='ml-auto'
            onClick={openCreate}
            disabled={createDisabled}
          >
            <Plus className='h-4 w-4' /> Add project
          </Button>
        )}
      </div>
      <div className='overflow-hidden rounded-xl border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead className='w-28 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map(project => {
              const deleting = isPending && pendingDeleteId === project.id

              return (
                <ProjectsSettingsTableRow
                  key={project.id}
                  project={project}
                  isDeleting={deleting}
                  onEdit={openEdit}
                  onDelete={handleRequestDelete}
                />
              )
            })}
            {sortedProjects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No projects yet. Create one from the Projects view to see it
                  here.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Delete project?'
        description='Deleting this project hides it from active views but keeps the history intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

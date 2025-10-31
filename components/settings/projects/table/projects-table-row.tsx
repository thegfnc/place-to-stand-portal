import {
  Archive,
  Building2,
  FolderKanban,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  getStatusBadgeToken,
} from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { cn } from '@/lib/utils'

import type { ProjectWithClient, ProjectsTableMode } from './types'

type ProjectsTableRowProps = {
  project: ProjectWithClient
  mode: ProjectsTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  onEdit: (project: ProjectWithClient) => void
  onRequestDelete: (project: ProjectWithClient) => void
  onRestore: (project: ProjectWithClient) => void
  onRequestDestroy: (project: ProjectWithClient) => void
}

export function ProjectsTableRow({
  project,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
}: ProjectsTableRowProps) {
  const client = project.client
  const isDeleting = isPending && pendingDeleteId === project.id
  const isRestoring = isPending && pendingRestoreId === project.id
  const isDestroying = isPending && pendingDestroyId === project.id

  const deleteDisabled =
    isDeleting || isRestoring || isDestroying || Boolean(project.deleted_at)
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
    <TableRow className={isArchived ? 'opacity-60' : undefined}>
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
        <Badge className={cn('text-xs', statusTone)}>{statusLabel}</Badge>
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
                <Archive className='h-4 w-4' />
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
                <Trash2 className='h-4 w-4' />
                <span className='sr-only'>Delete permanently</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

import { memo, useMemo } from 'react'
import { Building2, FolderKanban, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'

import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { cn } from '@/lib/utils'

import type { ProjectWithClient } from './types'

type ProjectsSettingsTableRowProps = {
  project: ProjectWithClient
  isDeleting: boolean
  onEdit: (project: ProjectWithClient) => void
  onDelete: (project: ProjectWithClient) => void
}

export const ProjectsSettingsTableRow = memo(
  ({
    project,
    isDeleting,
    onEdit,
    onDelete,
  }: ProjectsSettingsTableRowProps) => {
    const client = project.client

    const deleteLabel = useMemo(() => {
      return isDeleting ? 'Deleting project' : 'Delete project'
    }, [isDeleting])

    return (
      <TableRow>
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
          <Badge
            className={cn('text-xs', getProjectStatusToken(project.status))}
          >
            {getProjectStatusLabel(project.status)}
          </Badge>
        </TableCell>
        <TableCell className='text-muted-foreground text-sm'>
          {formatProjectDateRange(project.starts_on, project.ends_on)}
        </TableCell>
        <TableCell className='text-right'>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              size='icon'
              onClick={() => onEdit(project)}
              title='Edit project'
              disabled={isDeleting}
            >
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => onDelete(project)}
              title={deleteLabel}
              aria-label='Delete project'
              disabled={isDeleting}
            >
              <Trash2 className='h-4 w-4' />
              <span className='sr-only'>Delete</span>
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }
)

ProjectsSettingsTableRow.displayName = 'ProjectsSettingsTableRow'

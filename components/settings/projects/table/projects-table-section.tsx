import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { ProjectWithClient, ProjectsTableMode } from './types'
import { ProjectsTableRow } from './projects-table-row'

type ProjectsTableSectionProps = {
  projects: ProjectWithClient[]
  mode: ProjectsTableMode
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

export function ProjectsTableSection({
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
          {projects.map(project => (
            <ProjectsTableRow
              key={project.id}
              project={project}
              mode={mode}
              isPending={isPending}
              pendingReason={pendingReason}
              pendingDeleteId={pendingDeleteId}
              pendingRestoreId={pendingRestoreId}
              pendingDestroyId={pendingDestroyId}
              onEdit={onEdit}
              onRequestDelete={onRequestDelete}
              onRestore={onRestore}
              onRequestDestroy={onRequestDestroy}
            />
          ))}
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

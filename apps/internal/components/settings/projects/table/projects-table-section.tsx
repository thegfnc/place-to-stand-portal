import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

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

function isProjectSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (field === 'name' || field === 'created') &&
    (direction === 'asc' || direction === 'desc')
  )
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
  const { update, getParam } = useListParams({
    basePath: '/projects/archive',
    resetKeys: ['cursor', 'dir'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isProjectSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
            >
              Name
            </SortableTableHead>
            <TableHead className='hidden md:table-cell'>Owner</TableHead>
            <TableHead className='w-[max(7rem,9%)]'>Status</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='hidden w-[max(13rem,17%)] md:table-cell'
            >
              Timeline
            </SortableTableHead>
            <TableHead className='w-24 text-right'>Actions</TableHead>
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
              <FullWidthCell
                counts={{ base: 3, md: 5 }}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </FullWidthCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

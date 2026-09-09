'use client'

import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import type { UsersSettingsAssignments } from '@/lib/queries/users/assignments'
import { isUserSortValue } from '@/lib/settings/users/filters'
import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'

import { UsersTableRow } from '../components/table/users-table-row'

type UsersTableSectionProps = {
  rows: UserRowState[]
  /** Per-user client/project/task assignments, keyed by user id. */
  assignments: UsersSettingsAssignments
  mode: 'active' | 'archive'
  emptyMessage: string
  selfDeleteReason: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function UsersTableSection({
  rows,
  assignments,
  mode,
  emptyMessage,
  selfDeleteReason,
  basePath,
}: UsersTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isUserSortValue(rawSort) ? rawSort : undefined

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
              className='w-[20%]'
            >
              Name
            </SortableTableHead>
            <TableHead className='w-[22%]'>Email</TableHead>
            <TableHead className='w-[8%]'>Role</TableHead>
            <TableHead className='w-[12%]'>Access</TableHead>
            <TableHead className='w-[14%]'>Assigned</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-28'
            >
              Joined
            </SortableTableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <UsersTableRow
              key={row.user.id}
              row={row}
              assignment={assignments[row.user.id]}
              mode={mode}
              selfDeleteReason={selfDeleteReason}
            />
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
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

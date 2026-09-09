'use client'

import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import type { UsersSettingsAssignments } from '@/lib/queries/users/assignments'
import { isUserSortValue } from '@/lib/settings/users/filters'
import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'

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
            >
              Name
            </SortableTableHead>
            <TableHead className='hidden md:table-cell'>Email</TableHead>
            <TableHead className='hidden w-[max(5rem,7%)] md:table-cell'>Role</TableHead>
            <TableHead className='w-[max(7rem,9%)]'>Access</TableHead>
            <TableHead className='hidden w-[max(4rem,5%)] md:table-cell'>Clients</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='hidden w-[max(7rem,9%)] md:table-cell'
            >
              Joined
            </SortableTableHead>
            <TableHead className='w-24 text-right'>Actions</TableHead>
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
              <FullWidthCell
                counts={{ base: 3, md: 7 }}
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

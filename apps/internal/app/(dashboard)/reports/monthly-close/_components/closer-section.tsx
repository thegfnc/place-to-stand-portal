import { Building, UserCheck } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import type { CloserData } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type CloserSectionProps = {
  data: CloserData
  /** Billing hours whose as-of commission term has no closer (PRD 007). */
  unassignedHours: number
  /** Their closer share — reported under House (estimated), not paid. */
  unassignedAmount: number
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function CloserSection({
  data,
  unassignedHours,
  unassignedAmount,
}: CloserSectionProps) {
  return (
    <SectionShell
      compact
      icon={UserCheck}
      iconTone='rose'
      title='Closer'
      description={`20% closer fee at $${data.commissionPerHour}/hr on billing in — prepaid hours sold + net 30 hours logged.`}
      total={formatCurrency(data.totalAmount)}
    >
      {data.rows.length > 0 || unassignedHours > 0 ? (
        <SectionRowList>
          {data.rows.map(row => {
            const displayName = row.closerName ?? row.closerEmail
            const avatarSrc = `/api/storage/user-avatar/${row.closerUserId}?v=${encodeURIComponent(row.closerUpdatedAt)}`
            return (
              <SectionRow
                key={row.closerUserId}
                leading={
                  <Avatar className='h-7 w-7'>
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback className='text-[10px]'>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                }
                primary={displayName}
                secondary={row.clients.map(c => c.clientName).join(', ')}
                hours={row.totalHours}
                amount={row.totalCommission}
              />
            )
          })}
          {unassignedHours > 0 ? (
            <SectionRow
              leading={
                <div className='bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full'>
                  <Building className='h-3.5 w-3.5' />
                </div>
              }
              primary='No closer assigned'
              secondary='Closer share stays in house (estimated) — not paid out'
              hours={unassignedHours}
              amount={unassignedAmount}
            />
          ) : null}
        </SectionRowList>
      ) : (
        <SectionEmpty message='No closer activity this month.' />
      )}
    </SectionShell>
  )
}

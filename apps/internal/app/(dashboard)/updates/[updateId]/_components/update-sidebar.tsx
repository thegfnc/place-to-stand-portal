import type { ReactNode } from 'react'
import { CalendarRange, Clock, UserCog, Users } from 'lucide-react'

import type { ClientHoursTotals } from '@pts/db/hours'

import { formatCalendarDate } from '@/lib/dates'

type SidebarCardProps = {
  icon: ReactNode
  title: string
  children: ReactNode
}

export function SidebarCard({ icon, title, children }: SidebarCardProps) {
  return (
    <section className='bg-card text-card-foreground rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2'>
        <div className='bg-muted flex h-6 w-6 items-center justify-center rounded-md'>
          {icon}
        </div>
        <h2 className='text-sm font-semibold'>{title}</h2>
      </div>
      <div className='p-3'>{children}</div>
    </section>
  )
}

const iconClass = 'text-muted-foreground h-3.5 w-3.5'

export function PeriodCard({
  periodStart,
  periodEnd,
}: {
  periodStart: string
  periodEnd: string
}) {
  return (
    <SidebarCard icon={<CalendarRange className={iconClass} />} title='Period'>
      <p className='text-sm'>
        {formatCalendarDate(periodStart)} – {formatCalendarDate(periodEnd)}
      </p>
      <p className='text-muted-foreground mt-1 text-xs'>
        The body was generated from activity in this window. Editing it does not
        change the window.
      </p>
    </SidebarCard>
  )
}

/** Only rendered for prepaid clients; net-30 clients have no balance to report. */
export function HoursCard({ hours }: { hours: ClientHoursTotals }) {
  const rows: Array<[string, number]> = [
    ['Remaining', hours.remaining],
    ['Used', hours.used],
    ['Purchased', hours.purchased],
  ]
  return (
    <SidebarCard icon={<Clock className={iconClass} />} title='Hours'>
      <dl className='space-y-1.5'>
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className='flex items-baseline justify-between text-sm'
          >
            <dt className='text-muted-foreground'>{label}</dt>
            <dd
              className={
                index === 0 ? 'font-semibold tabular-nums' : 'tabular-nums'
              }
            >
              {formatHours(value)}
            </dd>
          </div>
        ))}
      </dl>
      {hours.remaining <= 0 ? (
        <p className='text-destructive mt-2 text-xs'>
          This client is out of prepaid hours. Double-check the hours line in
          the email before sending.
        </p>
      ) : null}
    </SidebarCard>
  )
}

export function RecipientsCard({ children }: { children: ReactNode }) {
  return (
    <SidebarCard icon={<Users className={iconClass} />} title='Recipients'>
      {children}
    </SidebarCard>
  )
}

function formatHours(value: number): string {
  return `${Math.round(value * 100) / 100} h`
}

export function StaffCard({ children }: { children: ReactNode }) {
  return (
    <SidebarCard icon={<UserCog className={iconClass} />} title='Staff (cc)'>
      {children}
    </SidebarCard>
  )
}

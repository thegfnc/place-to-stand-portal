'use client'

import type { ClientHoursTotals } from '@pts/db/hours'

import type { StaffMember } from '@/lib/updates/staff'

import { UpdateRecipients, type RecipientContact } from './update-recipients'
import {
  HoursCard,
  PeriodCard,
  RecipientsCard,
  StaffCard,
} from './update-sidebar'
import { UpdateStaffCc } from './update-staff-cc'

type UpdateAsideProps = {
  isSent: boolean
  hours: ClientHoursTotals | null
  periodStart: string
  periodEnd: string
  contacts: RecipientContact[]
  staff: StaffMember[]
  senderEmail: string
  to: string[]
  cc: string[]
  onToChange: (to: string[]) => void
  onCcChange: (cc: string[]) => void
  disabled?: boolean
}

/** The right column: balance, window, and who gets the email. */
export function UpdateAside({
  isSent,
  hours,
  periodStart,
  periodEnd,
  contacts,
  staff,
  senderEmail,
  to,
  cc,
  onToChange,
  onCcChange,
  disabled,
}: UpdateAsideProps) {
  return (
    <aside className='space-y-4'>
      {hours ? <HoursCard hours={hours} /> : null}
      <PeriodCard periodStart={periodStart} periodEnd={periodEnd} />
      <RecipientsCard>
        {isSent ? (
          <EmailList emails={to} empty='No recipients.' />
        ) : (
          <UpdateRecipients
            contacts={contacts}
            to={to}
            onChange={onToChange}
            disabled={disabled}
          />
        )}
      </RecipientsCard>
      <StaffCard>
        {isSent ? (
          <EmailList emails={cc} empty='No one was copied.' />
        ) : (
          <UpdateStaffCc
            staff={staff}
            cc={cc}
            onChange={onCcChange}
            senderEmail={senderEmail}
            disabled={disabled}
          />
        )}
      </StaffCard>
    </aside>
  )
}

function EmailList({ emails, empty }: { emails: string[]; empty: string }) {
  if (emails.length === 0)
    return <p className='text-muted-foreground text-sm'>{empty}</p>
  return (
    <ul className='space-y-1 text-sm'>
      {emails.map(email => (
        <li key={email} className='truncate'>
          {email}
        </li>
      ))}
    </ul>
  )
}

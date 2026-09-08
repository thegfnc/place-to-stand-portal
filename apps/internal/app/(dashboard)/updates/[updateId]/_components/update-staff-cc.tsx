'use client'

import { Checkbox } from '@pts/ui/checkbox'
import { Label } from '@pts/ui/label'

import type { StaffMember } from '@/lib/updates/staff'

type UpdateStaffCcProps = {
  staff: StaffMember[]
  /** Current `cc` list, lowercase emails. */
  cc: string[]
  onChange: (cc: string[]) => void
  /** The sender is never listed — they get the message in Sent. */
  senderEmail: string
  disabled?: boolean
}

/** Who on our side is copied. On by default; untick to leave someone out. */
export function UpdateStaffCc({
  staff,
  cc,
  onChange,
  senderEmail,
  disabled,
}: UpdateStaffCcProps) {
  const others = staff.filter(
    member => member.email !== senderEmail.toLowerCase()
  )

  if (others.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>No other staff to copy.</p>
    )
  }

  const toggle = (email: string, checked: boolean) =>
    onChange(
      checked ? [...new Set([...cc, email])] : cc.filter(item => item !== email)
    )

  return (
    <ul className='space-y-2'>
      {others.map(member => {
        const inputId = `cc-${member.id}`
        return (
          <li key={member.id} className='flex items-start gap-2'>
            <Checkbox
              id={inputId}
              checked={cc.includes(member.email)}
              onCheckedChange={checked =>
                toggle(member.email, checked === true)
              }
              disabled={disabled}
              className='mt-0.5'
            />
            <Label
              htmlFor={inputId}
              className='flex min-w-0 flex-col gap-0.5 font-normal'
            >
              <span className='truncate text-sm'>{member.name}</span>
              <span className='text-muted-foreground truncate text-xs'>
                {member.email}
              </span>
            </Label>
          </li>
        )
      })}
    </ul>
  )
}

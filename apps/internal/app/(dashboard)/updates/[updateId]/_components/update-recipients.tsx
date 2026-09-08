'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@pts/ui/button'
import { Checkbox } from '@pts/ui/checkbox'
import { Label } from '@pts/ui/label'

export type RecipientContact = {
  id: string
  name: string
  email: string
  isPrimary: boolean
}

type UpdateRecipientsProps = {
  contacts: RecipientContact[]
  /** Current `to` list, lowercase emails. */
  to: string[]
  onChange: (to: string[]) => void
  disabled?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The client's linked contacts as checkboxes, plus one-off addresses typed
 * in below. Both feed the same `to` list; the split is only so the common
 * case is a click and the rare case is still possible.
 */
export function UpdateRecipients({
  contacts,
  to,
  onChange,
  disabled,
}: UpdateRecipientsProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const contactEmails = new Set(
    contacts.map(contact => contact.email.toLowerCase())
  )
  const extras = to.filter(email => !contactEmails.has(email))

  const toggle = (email: string, checked: boolean) => {
    const normalized = email.toLowerCase()
    if (checked) {
      if (!to.includes(normalized)) onChange([...to, normalized])
    } else {
      onChange(to.filter(item => item !== normalized))
    }
  }

  const addExtra = () => {
    const email = draft.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setError(null)
    setDraft('')
    toggle(email, true)
  }

  return (
    <div className='space-y-3'>
      {contacts.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          No contacts are linked to this client yet.
        </p>
      ) : (
        <ul className='space-y-2'>
          {contacts.map(contact => {
            const email = contact.email.toLowerCase()
            const inputId = `recipient-${contact.id}`
            return (
              <li key={contact.id} className='flex items-start gap-2'>
                <Checkbox
                  id={inputId}
                  checked={to.includes(email)}
                  onCheckedChange={checked => toggle(email, checked === true)}
                  disabled={disabled}
                  className='mt-0.5'
                />
                <Label
                  htmlFor={inputId}
                  className='flex min-w-0 flex-col gap-0.5 font-normal'
                >
                  <span className='flex items-center gap-1.5'>
                    <span className='truncate text-sm'>{contact.name}</span>
                    {contact.isPrimary ? (
                      <Badge variant='outline' className='text-[10px]'>
                        Primary
                      </Badge>
                    ) : null}
                  </span>
                  <span className='text-muted-foreground truncate text-xs'>
                    {contact.email}
                  </span>
                </Label>
              </li>
            )
          })}
        </ul>
      )}

      {extras.length > 0 ? (
        <ul className='flex flex-wrap gap-1.5'>
          {extras.map(email => (
            <li key={email}>
              <Badge variant='secondary' className='gap-1 pr-1 font-normal'>
                {email}
                <button
                  type='button'
                  onClick={() => toggle(email, false)}
                  disabled={disabled}
                  aria-label={`Remove ${email}`}
                  className='hover:bg-muted rounded-sm p-0.5'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className='space-y-1'>
        <div className='flex gap-1.5'>
          <Input
            type='email'
            value={draft}
            onChange={event => {
              setDraft(event.target.value)
              if (error) setError(null)
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addExtra()
              }
            }}
            placeholder='Add another address'
            disabled={disabled}
            aria-label='Add recipient email'
            className='h-8 text-sm'
          />
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={addExtra}
            disabled={disabled || !draft.trim()}
            className='h-8'
            aria-label='Add recipient'
          >
            <Plus className='h-3.5 w-3.5' />
          </Button>
        </div>
        {error ? <p className='text-destructive text-xs'>{error}</p> : null}
      </div>
    </div>
  )
}

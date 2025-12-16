'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { EmailDetailSheet } from '@/app/(dashboard)/emails/_components/email-detail-sheet'
import type { EmailWithLinks } from '@/lib/queries/emails'

type LinkedEmail = {
  id: string
  subject: string | null
  fromEmail: string
  fromName: string | null
  receivedAt: string
  source: string
}

type Props = {
  emails: LinkedEmail[]
  isAdmin: boolean
}

export function ClientEmailsSection({ emails, isAdmin }: Props) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<EmailWithLinks | null>(null)

  // Fetch full email data when selected
  useEffect(() => {
    if (!selectedEmailId) return

    let cancelled = false
    fetch(`/api/emails/${selectedEmailId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setSelectedEmail(data) })
      .catch(() => { if (!cancelled) setSelectedEmail(null) })

    return () => { cancelled = true }
  }, [selectedEmailId])

  const handleClose = () => {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  const handleUpdate = (updated: EmailWithLinks) => {
    setSelectedEmail(updated)
  }

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
      <div className='bg-muted/30 flex items-center justify-between gap-3 border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
            <Mail className='text-muted-foreground h-4 w-4' />
          </div>
          <h2 className='text-lg font-semibold tracking-tight'>Linked Emails</h2>
          <Badge variant='secondary'>{emails.length}</Badge>
        </div>
        <Link href='/emails' className='text-sm text-muted-foreground hover:underline'>
          View all emails →
        </Link>
      </div>

      <div className='p-6'>
        {emails.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
            No emails linked to this client yet. Add contacts to enable auto-matching.
          </div>
        ) : (
          <div className='space-y-2'>
            {emails.slice(0, 10).map(email => (
              <div
                key={email.id}
                onClick={() => setSelectedEmailId(email.id)}
                className='flex items-center justify-between gap-4 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer'
              >
                <div className='flex-1 min-w-0'>
                  <div className='font-medium truncate'>
                    {email.subject || '(no subject)'}
                  </div>
                  <div className='text-sm text-muted-foreground truncate'>
                    {email.fromName || email.fromEmail}
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <Badge variant='outline' className='text-xs'>
                    {email.source === 'AUTOMATIC' ? 'Auto' : 'Manual'}
                  </Badge>
                  <span className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            {emails.length > 10 && (
              <div className='text-center pt-2'>
                <Link href='/emails?filter=linked' className='text-sm text-muted-foreground hover:underline'>
                  +{emails.length - 10} more emails
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <EmailDetailSheet
        email={selectedEmail}
        onClose={handleClose}
        onUpdate={handleUpdate}
        isAdmin={isAdmin}
      />
    </section>
  )
}

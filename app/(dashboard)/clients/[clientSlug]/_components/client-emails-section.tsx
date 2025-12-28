'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import type { MessageForClient } from '@/lib/queries/messages'

type Props = {
  messages: MessageForClient[]
  isAdmin: boolean
}

export function ClientEmailsSection({ messages, isAdmin }: Props) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
      <div className='bg-muted/30 flex items-center justify-between gap-3 border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
            <Mail className='text-muted-foreground h-4 w-4' />
          </div>
          <h2 className='text-lg font-semibold tracking-tight'>Messages</h2>
          <Badge variant='secondary'>{messages.length}</Badge>
        </div>
        <Link href='/inbox' className='text-sm text-muted-foreground hover:underline'>
          View inbox →
        </Link>
      </div>

      <div className='p-6'>
        {messages.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
            No messages linked to this client yet. Add contacts to enable auto-matching.
          </div>
        ) : (
          <div className='space-y-2'>
            {messages.slice(0, 10).map(msg => (
              <div
                key={msg.id}
                className='flex items-center justify-between gap-4 py-2 px-3 rounded-md hover:bg-muted/50'
              >
                <div className='flex-1 min-w-0'>
                  <div className='font-medium truncate'>
                    {msg.subject || '(no subject)'}
                  </div>
                  <div className='text-sm text-muted-foreground truncate'>
                    {msg.fromName || msg.fromEmail}
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <Badge variant='outline' className='text-xs'>
                    {msg.isInbound ? 'Inbound' : 'Outbound'}
                  </Badge>
                  <span className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            {messages.length > 10 && (
              <div className='text-center pt-2'>
                <Link href='/inbox' className='text-sm text-muted-foreground hover:underline'>
                  +{messages.length - 10} more messages
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

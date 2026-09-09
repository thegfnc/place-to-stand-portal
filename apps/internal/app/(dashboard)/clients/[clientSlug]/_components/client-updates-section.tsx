'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatCalendarDate } from '@/lib/dates'
import { updateComposerHref } from '@/lib/sheets/hrefs'

import { draftUpdateForClient } from '../actions'

export type ClientUpdateSummary = {
  id: string
  subject: string
  status: 'DRAFT' | 'SENT'
  sentAt: string | null
  createdAt: string
}

type ClientUpdatesSectionProps = {
  clientId: string
  updates: ClientUpdateSummary[]
}

/**
 * The client page's window onto updates: the most recent few, and the way to
 * start one. There is no updates index — the CLI lists them, and this section
 * covers the "find the one I was working on" case.
 */
export function ClientUpdatesSection({
  clientId,
  updates,
}: ClientUpdatesSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleDraft = () => {
    startTransition(async () => {
      const result = await draftUpdateForClient(clientId)
      if (!result.success) {
        toast({
          title: 'Unable to draft update',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      router.push(updateComposerHref(result.id))
    })
  }

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-muted flex h-7 w-7 items-center justify-center rounded-md'>
          <Mail className='text-muted-foreground h-4 w-4' />
        </div>
        <h2 className='font-semibold'>Updates</h2>
        <Button
          onClick={handleDraft}
          disabled={isPending}
          size='sm'
          variant='outline'
          className='ml-auto h-7'
        >
          {isPending ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          ) : (
            <Plus className='h-3.5 w-3.5' />
          )}
          Draft update
        </Button>
      </div>
      {updates.length === 0 ? (
        <p className='text-muted-foreground px-4 py-6 text-center text-sm'>
          No updates yet. Draft one here or with{' '}
          <code className='bg-muted rounded px-1 py-0.5 text-xs'>pts updates draft</code>.
        </p>
      ) : (
        <ul className='divide-y'>
          {updates.map(update => (
            <li key={update.id}>
              <Link
                href={updateComposerHref(update.id)}
                className='hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5 text-sm transition-colors'
              >
                <span className='min-w-0 flex-1 truncate'>{update.subject}</span>
                <span className='text-muted-foreground shrink-0 text-xs'>
                  {formatCalendarDate(update.sentAt ?? update.createdAt)}
                </span>
                <Badge
                  variant={update.status === 'SENT' ? 'default' : 'outline'}
                  className='shrink-0 text-[10px]'
                >
                  {update.status === 'SENT' ? 'Sent' : 'Draft'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

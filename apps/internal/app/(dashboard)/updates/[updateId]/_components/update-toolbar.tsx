'use client'

import { Eye, FlaskConical, Loader2, Pencil, Send } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { Badge } from '@/components/ui/badge'
import { formatCalendarDate } from '@/lib/dates'

type UpdateToolbarProps = {
  clientName: string
  sentAt: string | null
  hasChanges: boolean
  previewing: boolean
  isSaving: boolean
  isSending: boolean
  isTesting: boolean
  canSend: boolean
  /** Same content rules as send, minus recipients. */
  canTest: boolean
  /** Why send is disabled, shown as a tooltip; null when it is enabled. */
  sendBlocker: string | null
  testBlocker: string | null
  onTogglePreview: () => void
  onSave: () => void
  onSendTest: () => void
  onSend: () => void
}

export function UpdateToolbar({
  clientName,
  sentAt,
  hasChanges,
  previewing,
  isSaving,
  isSending,
  isTesting,
  canSend,
  canTest,
  sendBlocker,
  testBlocker,
  onTogglePreview,
  onSave,
  onSendTest,
  onSend,
}: UpdateToolbarProps) {
  const busy = isSaving || isSending || isTesting

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {sentAt ? (
        <Badge>Sent {formatCalendarDate(sentAt)}</Badge>
      ) : (
        <Badge variant='outline'>Draft{hasChanges ? ' · unsaved' : ''}</Badge>
      )}
      <span className='text-muted-foreground text-sm'>{clientName}</span>
      {!sentAt ? (
        <div className='ml-auto flex items-center gap-2'>
          <Button size='sm' variant='ghost' onClick={onTogglePreview}>
            {previewing ? (
              <Pencil className='h-3.5 w-3.5' />
            ) : (
              <Eye className='h-3.5 w-3.5' />
            )}
            {previewing ? 'Edit' : 'Preview'}
          </Button>
          <Hint text={hasChanges ? null : 'No unsaved changes.'}>
            <Button
              size='sm'
              variant='outline'
              onClick={onSave}
              disabled={busy || !hasChanges}
            >
              {isSaving ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : null}
              Save draft
            </Button>
          </Hint>
          <Hint
            text={
              testBlocker ??
              'Email this draft to yourself, as the client would see it.'
            }
          >
            <Button
              size='sm'
              variant='outline'
              onClick={onSendTest}
              disabled={!canTest}
            >
              {isTesting ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <FlaskConical className='h-3.5 w-3.5' />
              )}
              Send test
            </Button>
          </Hint>
          <Hint text={sendBlocker}>
            <Button size='sm' onClick={onSend} disabled={!canSend}>
              {isSending ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Send className='h-3.5 w-3.5' />
              )}
              Send
            </Button>
          </Hint>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Disabled buttons swallow pointer events, so the tooltip lives on a wrapper
 * that still receives them.
 */
function Hint({
  text,
  children,
}: {
  text: string | null
  children: React.ReactNode
}) {
  return (
    <span title={text ?? undefined} className='inline-flex'>
      {children}
    </span>
  )
}

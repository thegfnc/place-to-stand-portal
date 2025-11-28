'use client'

import { useCallback, useState, useTransition } from 'react'
import { FileText, Check, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { updateClientNotes } from '../actions'

type ClientNotesSectionProps = {
  clientId: string
  initialNotes: string | null
}

export function ClientNotesSection({
  clientId,
  initialNotes,
}: ClientNotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const hasChanges = notes !== savedNotes

  const handleSave = useCallback(() => {
    if (!hasChanges) return

    setFeedback(null)
    startTransition(async () => {
      const result = await updateClientNotes({
        clientId,
        notes: notes.trim() || null,
      })

      if (result.success) {
        setSavedNotes(notes)
        setFeedback({ type: 'success', message: 'Notes saved' })
        // Clear success feedback after 3 seconds
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback({
          type: 'error',
          message: result.error ?? 'Failed to save notes',
        })
      }
    })
  }, [clientId, notes, hasChanges])

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
      <div className='bg-muted/30 flex items-center justify-between gap-3 border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
            <FileText className='text-muted-foreground h-4 w-4' />
          </div>
          <h2 className='text-lg font-semibold tracking-tight'>Notes</h2>
          {hasChanges ? (
            <Badge variant='secondary' className='text-xs'>
              Unsaved changes
            </Badge>
          ) : null}
        </div>
        <div className='flex items-center gap-2'>
          {feedback ? (
            <span
              className={`text-sm ${feedback.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
            >
              {feedback.type === 'success' ? (
                <span className='flex items-center gap-1'>
                  <Check className='h-4 w-4' />
                  {feedback.message}
                </span>
              ) : (
                feedback.message
              )}
            </span>
          ) : null}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            size='sm'
          >
            {isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Save notes'
            )}
          </Button>
        </div>
      </div>
      <div className='p-6'>
        <RichTextEditor
          id='client-notes'
          value={notes}
          onChange={setNotes}
          placeholder='Add notes about this client, such as key contacts, communication preferences, or important context...'
          disabled={isPending}
          contentMinHeightClassName='[&_.ProseMirror]:min-h-[200px]'
        />
      </div>
    </section>
  )
}


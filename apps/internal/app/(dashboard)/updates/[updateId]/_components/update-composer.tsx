'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientHoursTotals } from '@pts/db/hours'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { ClientUpdateRow } from '@/lib/updates'
import type { ComposerTaskOption } from '@/lib/updates/composer-data'
import type { StaffMember } from '@/lib/updates/staff'
import type { ClientUpdateItem } from '@/lib/updates/types'

import {
  saveClientUpdateDraft,
  sendClientUpdateAction,
  sendClientUpdateTestAction,
} from '../actions'
import { EmailCardFooter, EmailCardHeader } from './email-card-chrome'
import { UpdateAside } from './update-aside'
import { UpdateItemsEditor } from './update-items-editor'
import type { RecipientContact } from './update-recipients'
import { UpdatePreview } from './update-preview'
import { UpdateToolbar } from './update-toolbar'

type UpdateComposerProps = {
  update: ClientUpdateRow
  clientName: string
  contacts: RecipientContact[]
  /** Null for net-30 clients. */
  hours: ClientHoursTotals | null
  /** The single call-to-action under the body. */
  portalHref: string
  greetingName: string | null
  taskOptions: ComposerTaskOption[]
  hints: Record<string, string>
  staff: StaffMember[]
  /** The sending admin's address, shown in the footer as the reply-to. */
  replyTo: string
}

export function UpdateComposer({
  update,
  clientName,
  contacts,
  hours,
  portalHref,
  greetingName,
  taskOptions,
  hints,
  staff,
  replyTo,
}: UpdateComposerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [subject, setSubject] = useState(update.subject)
  const [intro, setIntro] = useState(update.intro)
  const [items, setItems] = useState<ClientUpdateItem[]>(update.items)
  const [closing, setClosing] = useState(update.closing)
  const [to, setTo] = useState(update.recipients.to)
  const [cc, setCc] = useState(update.recipients.cc)
  const [previewing, setPreviewing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [testConfirmOpen, setTestConfirmOpen] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isSending, startSend] = useTransition()
  const [isTesting, startTest] = useTransition()

  const isSent = update.status === 'SENT'
  const busy = isSaving || isSending || isTesting
  const hasChanges =
    subject !== update.subject ||
    intro !== update.intro ||
    closing !== update.closing ||
    JSON.stringify(items) !== JSON.stringify(update.items) ||
    to.join(',') !== update.recipients.to.join(',') ||
    cc.join(',') !== update.recipients.cc.join(',')
  const contentReady =
    subject.trim().length > 0 &&
    items.length > 0 &&
    items.every(item => item.label.trim().length > 0)
  const canTest = !busy && contentReady
  const canSend = canTest && to.length > 0

  const draftPayload = () => ({
    id: update.id,
    subject,
    intro,
    items,
    closing,
    recipients: { to, cc },
  })

  const handleSave = () => {
    startSave(async () => {
      const result = await saveClientUpdateDraft(draftPayload())
      if (!result.success) {
        toast({
          title: 'Unable to save draft',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Draft saved' })
      router.refresh()
    })
  }

  // A test is the draft as it stands, so it saves first too.
  const handleSendTest = () => {
    setTestConfirmOpen(false)
    startTest(async () => {
      const saved = await saveClientUpdateDraft(draftPayload())
      if (!saved.success) {
        toast({
          title: 'Unable to save draft',
          description: saved.error,
          variant: 'destructive',
        })
        return
      }
      const result = await sendClientUpdateTestAction({ id: update.id })
      if (!result.success) {
        toast({
          title: 'Test not sent',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Test sent', description: `Check ${result.to}.` })
      router.refresh()
    })
  }

  // Send always saves first: what goes out must be what is on screen.
  const handleSend = () => {
    setConfirmOpen(false)
    startSend(async () => {
      const saved = await saveClientUpdateDraft(draftPayload())
      if (!saved.success) {
        toast({
          title: 'Unable to save draft',
          description: saved.error,
          variant: 'destructive',
        })
        return
      }
      const result = await sendClientUpdateAction({ id: update.id })
      if (!result.success) {
        toast({
          title: 'Not sent',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Update sent',
        description: `Delivered to ${to.length} recipient${to.length === 1 ? '' : 's'}.`,
      })
      router.refresh()
    })
  }

  const preview = (
    <UpdatePreview
      greetingName={greetingName}
      intro={intro}
      items={items}
      hoursRemaining={hours?.remaining ?? null}
      closing={closing}
      portalHref={portalHref}
    />
  )

  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
      <div className='space-y-4'>
        <UpdateToolbar
          clientName={clientName}
          sentAt={update.sentAt}
          hasChanges={hasChanges}
          previewing={previewing}
          isSaving={isSaving}
          isSending={isSending}
          isTesting={isTesting}
          canSend={canSend}
          canTest={canTest}
          onTogglePreview={() => setPreviewing(value => !value)}
          onSave={handleSave}
          onSendTest={() => setTestConfirmOpen(true)}
          onSend={() => setConfirmOpen(true)}
        />

        <div className='space-y-1.5'>
          <label htmlFor='update-subject' className='text-sm font-medium'>
            Subject
          </label>
          <Input
            id='update-subject'
            value={subject}
            onChange={event => setSubject(event.target.value)}
            disabled={isSent || busy}
            readOnly={isSent}
          />
        </div>

        {/* The page as the client sees it — white, dark ink, the branded
            card's wordmark and footer — regardless of app theme. */}
        <div className='email-paper bg-background text-foreground overflow-hidden rounded-lg border shadow-xs'>
          <EmailCardHeader />
          {isSent || previewing ? (
            preview
          ) : (
            <div className='space-y-4 px-8 py-2 text-[15px]'>
              <p>Hi {greetingName ?? 'there'},</p>
              <Textarea
                value={intro}
                onChange={event => setIntro(event.target.value)}
                placeholder='Opening line'
                disabled={busy}
                aria-label='Intro'
                rows={2}
                className='min-h-[48px] text-[15px] leading-relaxed'
              />
              <UpdateItemsEditor
                items={items}
                onChange={setItems}
                taskOptions={taskOptions}
                hints={hints}
                disabled={busy}
              />
              {hours ? (
                <p className='text-muted-foreground text-sm'>
                  The hours line is added at send from the live balance —
                  currently{' '}
                  <span className='text-foreground'>
                    {Math.round(hours.remaining * 100) / 100} hours
                  </span>{' '}
                  remaining.
                </p>
              ) : null}
              <Textarea
                value={closing}
                onChange={event => setClosing(event.target.value)}
                placeholder='Closing line'
                disabled={busy}
                aria-label='Closing'
                rows={2}
                className='min-h-[48px] text-[15px] leading-relaxed'
              />
            </div>
          )}
          <EmailCardFooter replyTo={replyTo} />
        </div>
      </div>

      <UpdateAside
        isSent={isSent}
        hours={hours}
        periodStart={update.periodStart}
        periodEnd={update.periodEnd}
        contacts={contacts}
        staff={staff}
        senderEmail={replyTo}
        to={isSent ? update.recipients.to : to}
        cc={isSent ? update.recipients.cc : cc}
        onToChange={setTo}
        onCcChange={setCc}
        disabled={busy}
      />

      <ConfirmDialog
        open={testConfirmOpen}
        title='Send a test?'
        description={`Would you like to send a test email to ${replyTo}? It goes only to you and does not change the draft.`}
        confirmLabel='Send test'
        onConfirm={handleSendTest}
        onCancel={() => setTestConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title='Send this update?'
        description={`It will go from your Gmail account to ${to.join(', ')}${cc.length > 0 ? `, copying ${cc.join(', ')}` : ''}.`}
        confirmLabel='Send'
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

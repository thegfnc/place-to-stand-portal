'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import type { EmailPortal, EmailTemplateEntry } from '@/lib/email/catalog'

import {
  DetailFooter,
  DetailHeader,
  Field,
  PaperPane,
  PreviewToolbar,
  SegmentedControl,
  TemplateList,
} from './detail-parts'

const PORTAL_LABELS: Record<EmailPortal, string> = {
  internal: 'Admin',
  client: 'Client',
}

type PreviewMode = 'html' | 'text'

/**
 * Read-only catalog of every outbound email, laid out like a mail client: the
 * list is the inbox, the detail is the message with its envelope header, and
 * the wiring sits under the message where it does not compete with it.
 */
export function EmailsBrowser({ entries }: { entries: EmailTemplateEntry[] }) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '')
  const [variantIndex, setVariantIndex] = useState(0)
  const [mode, setMode] = useState<PreviewMode>('html')
  const [wiringOpen, setWiringOpen] = useState(true)

  const selected = entries.find(entry => entry.id === selectedId) ?? entries[0]

  if (!selected) {
    return (
      <section className='bg-background text-muted-foreground rounded-xl border p-6 text-sm shadow-sm'>
        No email templates are registered.
      </section>
    )
  }

  const variant =
    selected.variants[Math.min(variantIndex, selected.variants.length - 1)]

  const selectTemplate = (id: string) => {
    setSelectedId(id)
    setVariantIndex(0)
  }

  return (
    <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start'>
      <div className='flex flex-col gap-3'>
        <TemplateList
          ariaLabel='Email templates'
          entries={entries}
          selectedId={selected.id}
          onSelect={selectTemplate}
          renderMeta={entry => (
            <>
              {entry.status === 'disabled' ? (
                <Badge variant='destructive'>Not sent</Badge>
              ) : null}
              {entry.portals.map(portal => (
                <Badge key={portal} variant='outline'>
                  {PORTAL_LABELS[portal]}
                </Badge>
              ))}
            </>
          )}
          renderSubtitle={entry => entry.variants[0]?.sample.subject}
        />
        <p className='text-muted-foreground px-3.5 text-xs leading-relaxed'>
          Marketing site form recaps and alerts are sent from that repo through
          the same Resend account. Not shown here.
        </p>
      </div>

      <section className='bg-background flex min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
        <DetailHeader
          avatar={
            <span className='bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-[13px] font-bold'>
              PS
            </span>
          }
          title={variant.sample.subject}
          rows={[
            {
              label: 'From',
              value: (
                <>
                  Place To Stand{' '}
                  <code className='text-muted-foreground text-[11px]'>
                    &lt;{stripDisplayName(selected.from)}&gt;
                  </code>
                </>
              ),
            },
            { label: 'To', value: selected.recipient },
            {
              label: 'Reply-to',
              value: <code className='text-[11px]'>{selected.replyTo}</code>,
            },
          ]}
        />

        <PreviewToolbar>
          {selected.variants.length > 1 ? (
            <SegmentedControl
              ariaLabel='Portal variant'
              options={selected.variants.map((item, index) => ({
                value: String(index),
                label: item.label,
              }))}
              value={String(selected.variants.indexOf(variant))}
              onChange={value => setVariantIndex(Number(value))}
            />
          ) : null}
          <SegmentedControl
            ariaLabel='Preview format'
            options={[
              { value: 'html', label: 'HTML' },
              { value: 'text', label: 'Plain text' },
            ]}
            value={mode}
            onChange={value => setMode(value as PreviewMode)}
          />
        </PreviewToolbar>

        <PaperPane>
          {mode === 'html' ? (
            <iframe
              key={`${selected.id}-${variant.label}`}
              title={`${selected.name} — ${variant.label} HTML preview`}
              sandbox=''
              srcDoc={variant.sample.html}
              className='h-[640px] w-full max-w-[600px] bg-transparent'
            />
          ) : (
            <pre className='w-full max-w-[520px] rounded-[10px] border border-slate-200 bg-white px-8 py-7 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-900'>
              {variant.sample.text}
            </pre>
          )}
        </PaperPane>

        <DetailFooter
          title='Wiring'
          open={wiringOpen}
          onToggle={() => setWiringOpen(open => !open)}
        >
          <dl className='grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2'>
            <Field label='Triggered by'>
              <ul className='flex flex-col gap-1'>
                {selected.triggers.map(trigger => (
                  <li key={trigger}>{trigger}</li>
                ))}
              </ul>
            </Field>
            <Field label='Delivery'>{selected.delivery}</Field>
            <Field label='Source'>
              <code className='text-xs'>{selected.source}</code>
            </Field>
            <Field label='Attachments'>{selected.attachments ?? 'None'}</Field>
          </dl>
          <p className='text-muted-foreground text-xs'>
            Sample data only. Links, names, and credentials shown are
            placeholders and do not work.
          </p>
        </DetailFooter>
      </section>
    </div>
  )
}

/** `Place To Stand <addr>` → `addr`; a bare address passes through. */
function stripDisplayName(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from
}

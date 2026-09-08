'use client'

import { FileText } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import type { PdfTemplateEntry } from '@/lib/pdf/catalog'

import {
  DetailFooter,
  DetailHeader,
  Field,
  PreviewToolbar,
  SegmentedControl,
  TemplateList,
} from './detail-parts'

/**
 * Read-only catalog of every PDF the apps render, in the same anatomy as the
 * emails tab: list, document header, the page itself, inputs underneath.
 */
export function PdfsBrowser({ entries }: { entries: PdfTemplateEntry[] }) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '')
  const [variantKey, setVariantKey] = useState(
    entries[0]?.variants[0]?.key ?? ''
  )
  const [inputsOpen, setInputsOpen] = useState(true)

  const selected = entries.find(entry => entry.id === selectedId) ?? entries[0]

  if (!selected) {
    return (
      <section className='bg-background text-muted-foreground rounded-xl border p-6 text-sm shadow-sm'>
        No PDF templates are registered.
      </section>
    )
  }

  const variant =
    selected.variants.find(item => item.key === variantKey) ??
    selected.variants[0]

  const selectTemplate = (id: string) => {
    setSelectedId(id)
    setVariantKey(
      entries.find(entry => entry.id === id)?.variants[0]?.key ?? ''
    )
  }

  const previewUrl = `/api/templates/pdf/${selected.id}?variant=${variant.key}`

  return (
    <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start'>
      <TemplateList
        ariaLabel='PDF templates'
        entries={entries}
        selectedId={selected.id}
        onSelect={selectTemplate}
        renderMeta={entry => (
          <>
            {entry.audiences.map(audience => (
              <Badge key={audience} variant='outline'>
                {audience}
              </Badge>
            ))}
          </>
        )}
        renderSubtitle={entry => entry.summary}
      />

      <section className='bg-background flex min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
        <DetailHeader
          avatar={
            <span className='bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-[10px]'>
              <FileText className='size-4' aria-hidden='true' />
            </span>
          }
          title={selected.name}
          rows={[
            {
              label: 'Used by',
              value: (
                <ul className='flex flex-col'>
                  {selected.usedBy.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            },
            {
              label: 'Source',
              value: <code className='text-[11px]'>{selected.source}</code>,
            },
          ]}
        />

        <PreviewToolbar>
          {selected.variants.length > 1 ? (
            <SegmentedControl
              ariaLabel='Variant'
              options={selected.variants.map(item => ({
                value: item.key,
                label: item.label,
              }))}
              value={variant.key}
              onChange={setVariantKey}
            />
          ) : null}
        </PreviewToolbar>

        {/*
          Chrome's viewer honours these open parameters: hide the thumbnail
          pane (every template here is a single page; the toolbar can reopen
          it) and fit the page to the pane's width.
        */}
        <iframe
          key={previewUrl}
          title={`${selected.name} — ${variant.label} preview`}
          src={`${previewUrl}#navpanes=0&view=FitH`}
          className='h-[860px] w-full bg-slate-50'
        />

        <DetailFooter
          title='Inputs'
          open={inputsOpen}
          onToggle={() => setInputsOpen(open => !open)}
        >
          <dl className='grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2 lg:grid-cols-3'>
            {selected.inputs.map(input => (
              <Field key={input.label} label={input.label}>
                {input.detail}
              </Field>
            ))}
          </dl>
          <p className='text-muted-foreground text-xs'>
            {variant.description} Sample data only, rendered live through the
            real generator.
          </p>
        </DetailFooter>
      </section>
    </div>
  )
}

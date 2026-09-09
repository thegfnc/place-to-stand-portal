'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  diffWords,
  htmlToPlainText,
  type DiffSegment,
} from '@/lib/activity/text-diff'
import { cn } from '@/lib/utils'

type ActivityRichTextDiffProps = {
  before: string | null
  after: string | null
  isHtml: boolean
}

/**
 * Collapsed by default: the header states what happened ("Rewrote · +12 −4
 * words"), and expanding reveals a word-level diff. Very large edits fall
 * back to side-by-side before/after blocks.
 */
export function ActivityRichTextDiff({
  before,
  after,
  isHtml,
}: ActivityRichTextDiffProps) {
  const [open, setOpen] = useState(false)

  const model = useMemo(() => {
    const beforeText = normalise(before, isHtml)
    const afterText = normalise(after, isHtml)

    if (!beforeText && !afterText) return null
    if (!beforeText) return { mode: 'added' as const, beforeText, afterText, segments: null, counts: null }
    if (!afterText) return { mode: 'cleared' as const, beforeText, afterText, segments: null, counts: null }
    // Same words, different markup (a list became a paragraph, a stray space
    // went away): there is nothing to diff, so say so instead of "Edited".
    if (beforeText === afterText) {
      return { mode: 'formatting' as const, beforeText, afterText, segments: null, counts: null }
    }

    const segments = diffWords(beforeText, afterText)
    return {
      mode: 'changed' as const,
      beforeText,
      afterText,
      segments,
      counts: segments ? countWords(segments) : null,
    }
  }, [before, after, isHtml])

  if (!model) {
    return <span className='text-muted-foreground italic'>Empty</span>
  }

  const headline =
    model.mode === 'added'
      ? 'Added'
      : model.mode === 'cleared'
        ? 'Cleared'
        : model.mode === 'formatting'
          ? 'Formatting only'
          : 'Edited'

  return (
    <div className='min-w-0'>
      <button
        type='button'
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className='text-foreground hover:text-primary inline-flex items-center gap-1 font-medium'
      >
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3 w-3 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden='true'
        />
        {headline}
        {model.counts ? (
          <span className='text-muted-foreground ml-1 font-normal'>
            {model.counts.added > 0 ? (
              <span className='text-emerald-700 dark:text-emerald-300'>
                +{model.counts.added}
              </span>
            ) : null}
            {model.counts.added > 0 && model.counts.removed > 0 ? ' ' : null}
            {model.counts.removed > 0 ? (
              <span className='text-rose-700 dark:text-rose-300'>
                −{model.counts.removed}
              </span>
            ) : null}
            {model.counts.added > 0 || model.counts.removed > 0
              ? ' words'
              : null}
          </span>
        ) : null}
        <span className='sr-only'>{open ? 'Hide' : 'Show'} change</span>
      </button>

      {open ? (
        <div className='bg-muted/30 mt-1.5 max-h-72 overflow-y-auto rounded-md border p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap'>
          {model.mode === 'added' ? (
            <p className='rounded-sm bg-emerald-500/10 px-1 text-emerald-900 dark:text-emerald-100'>
              {model.afterText}
            </p>
          ) : model.mode === 'formatting' ? (
            <p className='text-muted-foreground'>{model.afterText}</p>
          ) : model.mode === 'cleared' ? (
            <p className='rounded-sm bg-rose-500/10 px-1 text-rose-900 line-through dark:text-rose-100'>
              {model.beforeText}
            </p>
          ) : model.segments ? (
            <DiffText segments={model.segments} />
          ) : (
            <SideBySide before={model.beforeText} after={model.afterText} />
          )}
        </div>
      ) : null}
    </div>
  )
}

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <p>
      {segments.map((segment, index) => {
        if (segment.type === 'same') {
          return <span key={index}>{segment.text}</span>
        }

        return (
          <mark
            key={index}
            className={cn(
              'rounded-sm px-0.5',
              segment.type === 'added'
                ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                : 'bg-rose-500/15 text-rose-900 line-through dark:text-rose-100'
            )}
          >
            {segment.text}
          </mark>
        )
      })}
    </p>
  )
}

function SideBySide({ before, after }: { before: string; after: string }) {
  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      <div>
        <p className='text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase'>
          Before
        </p>
        <p className='text-muted-foreground'>{before}</p>
      </div>
      <div>
        <p className='text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase'>
          After
        </p>
        <p>{after}</p>
      </div>
    </div>
  )
}

function normalise(value: string | null, isHtml: boolean): string {
  if (!value) return ''
  return (isHtml ? htmlToPlainText(value) : value).trim()
}

function countWords(segments: DiffSegment[]): { added: number; removed: number } {
  let added = 0
  let removed = 0

  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/).filter(Boolean).length
    if (segment.type === 'added') added += words
    if (segment.type === 'removed') removed += words
  }

  return { added, removed }
}

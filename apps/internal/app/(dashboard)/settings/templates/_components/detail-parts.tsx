'use client'

import { cn } from '@/lib/utils'

export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {label}
      </dt>
      <dd className='min-w-0 break-words'>{children}</dd>
    </div>
  )
}

export function SegmentedControl({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      role='group'
      aria-label={ariaLabel}
      className='bg-muted inline-flex rounded-md p-0.5 text-xs'
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded px-2.5 py-1 font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Inbox-style list: a name with trailing chips on the first line and a
 * subtitle (subject line, format) underneath, like a mail client's message list.
 */
export function TemplateList<T extends { id: string; name: string }>({
  ariaLabel,
  entries,
  selectedId,
  onSelect,
  renderMeta,
  renderSubtitle,
}: {
  ariaLabel: string
  entries: T[]
  selectedId: string
  onSelect: (id: string) => void
  renderMeta?: (entry: T) => React.ReactNode
  renderSubtitle?: (entry: T) => React.ReactNode
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className='bg-background rounded-xl border p-1.5 shadow-sm'
    >
      <ul className='flex flex-col gap-0.5'>
        {entries.map(entry => {
          const active = entry.id === selectedId
          return (
            <li key={entry.id}>
              <button
                type='button'
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(entry.id)}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-lg px-3.5 py-3 text-left text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/60 hover:text-accent-foreground'
                )}
              >
                <span className='flex items-center justify-between gap-2'>
                  <span className='font-semibold'>{entry.name}</span>
                  {renderMeta ? (
                    <span className='flex shrink-0 gap-1'>
                      {renderMeta(entry)}
                    </span>
                  ) : null}
                </span>
                {renderSubtitle ? (
                  <span className='text-muted-foreground block truncate text-xs'>
                    {renderSubtitle(entry)}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** The message-style header shared by both tabs. */
export function DetailHeader({
  avatar,
  title,
  rows,
}: {
  avatar: React.ReactNode
  title: string
  rows: { label: string; value: React.ReactNode }[]
}) {
  return (
    <header className='flex items-start gap-3.5 border-b px-5 py-4'>
      <div className='flex size-10 shrink-0 items-center justify-center rounded-full'>
        {avatar}
      </div>
      <div className='flex min-w-0 flex-grow flex-col gap-1.5'>
        <h2 className='text-base font-semibold break-words'>{title}</h2>
        <dl className='grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs leading-relaxed'>
          {rows.map(row => (
            <div key={row.label} className='contents'>
              <dt className='text-muted-foreground'>{row.label}</dt>
              <dd className='min-w-0 break-words'>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}

/** Toggle row directly above the paper preview, aligned with the header text. */
export function PreviewToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-nowrap items-center gap-2 overflow-x-auto border-b px-5 py-2'>
      {children}
    </div>
  )
}

/** Collapsible footer panel under the paper preview. */
export function DetailFooter({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <footer className='flex flex-col gap-3 border-t px-5 py-4'>
      <button
        type='button'
        aria-expanded={open}
        onClick={onToggle}
        className='flex items-center justify-between text-left'
      >
        <span className='text-sm font-semibold'>{title}</span>
        <span className='text-muted-foreground text-xs'>
          {open ? 'Collapse' : 'Expand'}
        </span>
      </button>
      {open ? children : null}
    </footer>
  )
}

/** Light "paper" surface the rendered document sits on, in either theme. */
export function PaperPane({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex justify-center bg-slate-50 p-8 dark:bg-slate-50'>
      {children}
    </div>
  )
}

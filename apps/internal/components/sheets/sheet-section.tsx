'use client'

import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SheetSectionProps = {
  title: string
  /** One line under the title — the place for copy that used to hang off each field. */
  description?: string
  /** Right-aligned slot on the title row (a "Link contact" button, a count). */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A titled group of fields inside a sheet body. Sheets separate sections
 * with `<Separator />`; the title row matches the submission sheet's
 * section heading so read-only and form sheets share one vocabulary.
 */
export function SheetSection({
  title,
  description,
  action,
  children,
  className,
}: SheetSectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className='flex flex-col gap-1'>
        <div className='flex min-h-5 items-center justify-between gap-2'>
          <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
          {action}
        </div>
        {description ? (
          <p className='text-muted-foreground text-xs'>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

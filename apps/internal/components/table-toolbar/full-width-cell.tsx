'use client'

import { useSyncExternalStore, type ComponentProps } from 'react'

import { TableCell } from '@pts/ui/table'

/**
 * The column-visibility tiers from the width rule (docs/design-system.md →
 * Table Column Widths): columns hide with `hidden md:table-cell` and
 * `hidden xl:table-cell`, so a table has three possible visible counts.
 */
export type VisibleColumnCounts = {
  /** Columns visible below `md`. */
  base: number
  /** Columns visible from `md` (defaults to `base`). */
  md?: number
  /** Columns visible from `xl` (defaults to `md`). */
  xl?: number
}

type Tier = 'base' | 'md' | 'xl'

const MD_QUERY = '(min-width: 768px)'
const XL_QUERY = '(min-width: 1280px)'

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(MD_QUERY), window.matchMedia(XL_QUERY)]
  for (const query of queries) query.addEventListener('change', onChange)
  return () => {
    for (const query of queries) query.removeEventListener('change', onChange)
  }
}

function getSnapshot(): Tier {
  if (window.matchMedia(XL_QUERY).matches) return 'xl'
  if (window.matchMedia(MD_QUERY).matches) return 'md'
  return 'base'
}

// No viewport on the server: assume the widest tier and let the client
// snapshot correct it right after hydration.
const getServerSnapshot = (): Tier => 'xl'

export function useVisibleColumnCount(counts: VisibleColumnCounts): number {
  const tier = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const md = counts.md ?? counts.base
  const xl = counts.xl ?? md
  return tier === 'xl' ? xl : tier === 'md' ? md : counts.base
}

type FullWidthCellProps = Omit<ComponentProps<typeof TableCell>, 'colSpan'> & {
  counts: VisibleColumnCounts
}

/**
 * A cell that spans every *visible* column — empty states and group
 * separator rows. Under `table-layout: fixed` a `colSpan` wider than the
 * visible header does not clamp: the browser adds anonymous columns and
 * hands them the leftover width, which squeezes the identity column and
 * leaves a blank strip on the right. Declare the per-tier counts instead.
 */
export function FullWidthCell({ counts, ...props }: FullWidthCellProps) {
  const colSpan = useVisibleColumnCount(counts)
  return <TableCell colSpan={colSpan} {...props} />
}

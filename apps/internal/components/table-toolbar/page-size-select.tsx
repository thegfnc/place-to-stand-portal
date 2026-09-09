'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import {
  PAGE_SIZE_COOKIE,
  PAGE_SIZE_COOKIE_MAX_AGE,
  PAGE_SIZE_OPTIONS,
  parsePageSize,
} from '@/lib/pagination/page-size'
import { cn } from '@/lib/utils'

/** URL keys that stop meaning anything once the page length changes. */
const PAGINATION_KEYS = ['page', 'cursor', 'dir', 'limit'] as const

type PageSizeSelectProps = {
  /** The size the current page was rendered with (from the cookie). */
  value: number
  className?: string
}

/**
 * Rows-per-page control for every list footer. Persists the choice in the
 * global `pts_page_size` cookie, then re-navigates with the pagination keys
 * stripped so the server re-reads the cookie from page 1 — offsets and
 * keyset cursors minted under the old size are meaningless.
 */
export function PageSizeSelect({ value, className }: PageSizeSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = useCallback(
    (next: string) => {
      const size = parsePageSize(next)
      if (size === value) return

      document.cookie = `${PAGE_SIZE_COOKIE}=${size}; path=/; max-age=${PAGE_SIZE_COOKIE_MAX_AGE}; samesite=lax`

      const params = new URLSearchParams(searchParams.toString())
      for (const key of PAGINATION_KEYS) params.delete(key)
      const query = params.toString()
      const href = query ? `${pathname}?${query}` : pathname
      const current = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname

      // Same URL = no navigation event, so force the server re-render.
      if (href === current) {
        router.refresh()
      } else {
        router.push(href, { scroll: false })
      }
    },
    [pathname, router, searchParams, value]
  )

  return (
    <label
      className={cn(
        'text-muted-foreground flex items-center gap-2 text-xs',
        className
      )}
    >
      <Select value={String(value)} onValueChange={handleChange}>
        <SelectTrigger
          aria-label='Rows per page'
          className='h-7 w-[4.25rem] px-2 text-xs tabular-nums'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map(option => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className='whitespace-nowrap'>rows per page</span>
    </label>
  )
}

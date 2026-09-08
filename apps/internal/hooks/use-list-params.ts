'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Filter/search key declaration (PRD 004 §03, R2). Filters are declared
 * SEPARATELY from sort — `sort` must never be listed here, so sort-only
 * changes can never read as "filtered" (no `Showing N of M`, no
 * filtered-empty messaging).
 */
type ListFilterConfig = {
  /** Raw-value validator; invalid params don't count as active (PRD-003 R4). */
  isValid?: (value: string) => boolean
  /**
   * Normalized default when the param is absent. A param equal to this is
   * inactive (projects' implicit clean-URL status default).
   */
  defaultValue?: string
}

type UseListParamsOptions = {
  /** Route the filter state lives on ('/settings/users'). */
  basePath: string
  /** Pagination keys cleared on every update ('cursor'+'dir', or 'page'). */
  resetKeys: readonly string[]
  /** Filter/search keys only — never sort (R2). */
  filters?: Record<string, ListFilterConfig>
}

export function useListParams({
  basePath,
  resetKeys,
  filters,
}: UseListParamsOptions) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      // Keyset invariant: any change through this hook resets pagination —
      // a stale cursor against a re-filtered/re-sorted set must be impossible.
      for (const key of resetKeys) {
        next.delete(key)
      }

      const queryString = next.toString()
      router.push(queryString ? `${basePath}?${queryString}` : basePath)
    },
    [basePath, resetKeys, router, searchParams]
  )

  const getParam = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams]
  )

  /**
   * Clear every declared filter key back to its default (absent) state.
   * Removing a param restores its implicit default (e.g. projects' status
   * filter), and `update` already clears pagination keys.
   */
  const reset = useCallback(() => {
    if (!filters) return
    update(
      Object.fromEntries(Object.keys(filters).map(key => [key, undefined]))
    )
  }, [filters, update])

  const hasActiveFilters = useMemo(() => {
    if (!filters) return false

    return Object.entries(filters).some(([key, config]) => {
      const raw = searchParams.get(key)
      if (raw === null) return false
      if (config.isValid && !config.isValid(raw)) return false
      if (config.defaultValue !== undefined) {
        return raw !== config.defaultValue
      }
      return raw.length > 0
    })
  }, [filters, searchParams])

  return { update, getParam, hasActiveFilters, reset }
}

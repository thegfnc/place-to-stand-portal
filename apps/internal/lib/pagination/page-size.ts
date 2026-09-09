/**
 * One page size for every paginated list (paged and keyset alike).
 *
 * The user's choice is a single global cookie (`pts_page_size`) written by
 * `PageSizeSelect` and read server-side in each list page via
 * `readPageSize()` (page-size.server.ts) — the same SSR-cookie pattern as
 * the sidebar's `sidebar_state`, so the first paint already has the right
 * row count. Query-layer clamps import `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`
 * from here so no list can drift to its own default again.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export const DEFAULT_PAGE_SIZE: PageSizeOption = 25
export const MAX_PAGE_SIZE: PageSizeOption = 100

export const PAGE_SIZE_COOKIE = 'pts_page_size'
export const PAGE_SIZE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isPageSizeOption(value: number): value is PageSizeOption {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
}

/** Cookie/param value → a valid option, falling back to the default. */
export function parsePageSize(raw: string | null | undefined): PageSizeOption {
  if (!raw) return DEFAULT_PAGE_SIZE
  const parsed = Number.parseInt(raw, 10)
  return isPageSizeOption(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

/** Shared clamp options for the keyset queries (`clampLimit`). */
export const PAGE_SIZE_LIMITS = {
  defaultLimit: DEFAULT_PAGE_SIZE,
  maxLimit: MAX_PAGE_SIZE,
} as const

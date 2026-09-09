import type { ProjectTypeValue } from '@/lib/types'

/**
 * The My Tasks board's project-type scope, carried in the `?hide=` param as a
 * comma list drawn from `personal,internal` (absent = show both). PERSONAL
 * and INTERNAL projects have no client, so the `?clientId=` filter alone can
 * never hide them; this is the other half of the client selector.
 *
 * Shared by the server page, the API routes, and the client selector, so the
 * parse and serialize halves stay in one place. No server dependency.
 */

export const HIDE_PARAM = 'hide'

/** URL tokens in canonical order — the order the URL and trigger hint use. */
export const HIDEABLE_PROJECT_TYPE_TOKENS = ['personal', 'internal'] as const

export type HideableProjectTypeToken =
  (typeof HIDEABLE_PROJECT_TYPE_TOKENS)[number]

/** Project types the board can hide, keyed by their URL token. */
export const HIDEABLE_PROJECT_TYPES = {
  personal: 'PERSONAL',
  internal: 'INTERNAL',
} as const satisfies Record<HideableProjectTypeToken, ProjectTypeValue>

export type HideableProjectType =
  (typeof HIDEABLE_PROJECT_TYPES)[HideableProjectTypeToken]

/** Tuple-typed so it can feed `z.enum` directly. */
export const HIDEABLE_PROJECT_TYPE_VALUES = [
  'PERSONAL',
  'INTERNAL',
] as const satisfies readonly HideableProjectType[]

function isHideableToken(value: string): value is HideableProjectTypeToken {
  return (HIDEABLE_PROJECT_TYPE_TOKENS as readonly string[]).includes(value)
}

export function isHideableProjectType(
  value: string
): value is HideableProjectType {
  return (HIDEABLE_PROJECT_TYPE_VALUES as readonly string[]).includes(value)
}

/**
 * `?hide=` → project types to exclude. Unknown tokens and duplicates are
 * dropped; the result is in canonical order regardless of URL order.
 */
export function parseHiddenProjectTypes(
  raw: string | null | undefined
): HideableProjectType[] {
  if (!raw) {
    return []
  }

  const requested = new Set(
    raw
      .split(',')
      .map(token => token.trim().toLowerCase())
      .filter(isHideableToken)
  )

  return HIDEABLE_PROJECT_TYPE_TOKENS.filter(token => requested.has(token)).map(
    token => HIDEABLE_PROJECT_TYPES[token]
  )
}

/**
 * Project types to exclude → `?hide=` value, or null when nothing is hidden
 * so the default URL stays clean.
 */
export function serializeHiddenProjectTypes(
  hidden: readonly ProjectTypeValue[]
): string | null {
  const tokens = HIDEABLE_PROJECT_TYPE_TOKENS.filter(token =>
    hidden.includes(HIDEABLE_PROJECT_TYPES[token])
  )

  return tokens.length > 0 ? tokens.join(',') : null
}

/** Trigger-hint copy: `no personal, internal` (empty string when none). */
export function describeHiddenProjectTypes(
  hidden: readonly ProjectTypeValue[]
): string {
  const tokens = HIDEABLE_PROJECT_TYPE_TOKENS.filter(token =>
    hidden.includes(HIDEABLE_PROJECT_TYPES[token])
  )

  return tokens.length > 0 ? `no ${tokens.join(', ')}` : ''
}

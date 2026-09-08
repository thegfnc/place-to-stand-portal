/**
 * Plain-text matching for cmdk-powered pickers.
 *
 * cmdk's default filter is a fuzzy scorer: any option whose text contains the
 * typed letters *in order* survives, so "Sales" matched "Bass Marketing /
 * Landing pages" (s…a…l…e…s). For a list of named records that is noise —
 * people type a word they remember from the label, not a letter sequence.
 *
 * This filter treats the query as whitespace-separated tokens and requires
 * every token to appear as a contiguous substring of the option text (label
 * plus keywords). Matches are ranked so exact and prefix hits float above
 * mid-word hits; ties keep the caller's order because cmdk's sort is stable.
 */

const normalize = (input: string) =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const isWordStart = (haystack: string, index: number) =>
  index === 0 || !/[\p{L}\p{N}]/u.test(haystack[index - 1] ?? '')

const wordStartIndex = (haystack: string, needle: string) => {
  let from = 0
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from)
    if (index === -1) {
      return -1
    }
    if (isWordStart(haystack, index)) {
      return index
    }
    from = index + 1
  }
  return -1
}

export const SEARCH_SCORE = {
  exact: 1,
  prefix: 0.9,
  phraseAtWordStart: 0.8,
  tokensAtWordStart: 0.7,
  substring: 0.5,
  none: 0,
} as const

/**
 * Score how well `search` matches `value` (+ optional `keywords`).
 * Returns 0 for no match; higher is better. Shaped as a cmdk `filter`.
 */
export function scoreSearchMatch(
  value: string,
  search: string,
  keywords?: string[]
): number {
  const query = normalize(search)
  if (query.length === 0) {
    return SEARCH_SCORE.exact
  }

  const label = normalize(value)
  const haystack = normalize([value, ...(keywords ?? [])].join(' '))
  const tokens = query.split(' ')

  if (!tokens.every(token => haystack.includes(token))) {
    return SEARCH_SCORE.none
  }

  if (label === query) {
    return SEARCH_SCORE.exact
  }

  if (label.startsWith(query)) {
    return SEARCH_SCORE.prefix
  }

  if (wordStartIndex(haystack, query) !== -1) {
    return SEARCH_SCORE.phraseAtWordStart
  }

  if (tokens.every(token => wordStartIndex(haystack, token) !== -1)) {
    return SEARCH_SCORE.tokensAtWordStart
  }

  return SEARCH_SCORE.substring
}

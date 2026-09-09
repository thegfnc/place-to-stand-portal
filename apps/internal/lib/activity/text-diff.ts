/**
 * Small word-level diff for activity feed change previews.
 *
 * Deliberately dependency-free: the feed only needs "what words changed" for
 * descriptions and notes, not a patch format. Tokens are words plus their
 * trailing whitespace so the rendered output reflows naturally.
 */

export type DiffSegment = {
  type: 'same' | 'added' | 'removed'
  text: string
}

/** Inputs longer than this (in tokens) skip the diff and render as blocks. */
const MAX_TOKENS = 1200

export function diffWords(before: string, after: string): DiffSegment[] | null {
  const a = tokenize(before)
  const b = tokenize(after)

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return null
  }

  // Trim the common prefix/suffix first so the DP table only covers the
  // region that actually differs.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1
  }

  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  const segments: DiffSegment[] = []
  pushSegment(segments, 'same', a.slice(0, start).join(''))

  for (const segment of lcsDiff(midA, midB)) {
    pushSegment(segments, segment.type, segment.text)
  }

  pushSegment(segments, 'same', a.slice(endA).join(''))

  return segments
}

function lcsDiff(a: string[], b: string[]): DiffSegment[] {
  const n = a.length
  const m = b.length

  if (n === 0 && m === 0) return []
  if (n === 0) return [{ type: 'added', text: b.join('') }]
  if (m === 0) return [{ type: 'removed', text: a.join('') }]

  // lengths[i][j] = LCS length of a[i..] and b[j..]
  const lengths: Uint16Array[] = Array.from(
    { length: n + 1 },
    () => new Uint16Array(m + 1)
  )

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const out: DiffSegment[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSegment(out, 'same', a[i])
      i += 1
      j += 1
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      pushSegment(out, 'removed', a[i])
      i += 1
    } else {
      pushSegment(out, 'added', b[j])
      j += 1
    }
  }

  while (i < n) {
    pushSegment(out, 'removed', a[i])
    i += 1
  }
  while (j < m) {
    pushSegment(out, 'added', b[j])
    j += 1
  }

  return out
}

function pushSegment(
  segments: DiffSegment[],
  type: DiffSegment['type'],
  text: string
) {
  if (!text) return
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.text += text
    return
  }
  segments.push({ type, text })
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? []
}

/**
 * Collapse editor HTML into readable plain text for diffing: block elements
 * become line breaks, inline tags disappear, entities decode. Runs on both
 * server and client, so no DOM access.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Task descriptions and comments are stored as TipTap HTML. Plain text survives
 * a read — the editor renders it as one paragraph — but every newline is
 * collapsed, and the first time someone opens and saves the task in the UI the
 * editor rewrites it to HTML, producing a spurious "updated description"
 * activity entry.
 *
 * So convert on the way in. Callers send plain text or minimal markdown (what a
 * CLI flag or an agent naturally produces) and we store what the editor would
 * have stored. Supported: paragraphs on blank lines, `- ` / `* ` bullets,
 * `1. ` numbered lists, **bold**, *italic*, `code`, and [text](https://…)
 * links — the same inline set as client-update items, plus code spans since a
 * comment for the team often names a branch or a command. Anything else is
 * escaped as text. Input that already looks like HTML passes through untouched.
 */

import { escapeHtml, inlineMarkdown } from '@/lib/updates/markdown'

const HTML_BLOCK = /<(p|ul|ol|li|h[1-6]|blockquote|pre|div|br)\b/i
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d+[.)]\s+(.*)$/
const CODE_SPAN = /`([^`\n]+)`/g

/**
 * Inline markdown for one line. Code spans are split out first so their
 * contents are never re-parsed for emphasis or links.
 */
function inline(text: string): string {
  const out: string[] = []
  let last = 0

  for (const match of text.matchAll(CODE_SPAN)) {
    out.push(inlineMarkdown(text.slice(last, match.index)))
    out.push(`<code>${escapeHtml(match[1])}</code>`)
    last = match.index + match[0].length
  }

  out.push(inlineMarkdown(text.slice(last)))

  return out.join('')
}

type ListKind = 'ul' | 'ol'

export function toRichTextHtml(input: string): string {
  if (!input.trim()) {
    return ''
  }

  if (HTML_BLOCK.test(input)) {
    return input
  }

  const out: string[] = []
  let list: { kind: ListKind; items: string[] } | null = null

  const flushList = () => {
    if (!list) {
      return
    }

    const items = list.items.map(item => `<li><p>${inline(item)}</p></li>`)
    out.push(`<${list.kind}>${items.join('')}</${list.kind}>`)
    list = null
  }

  const pushItem = (kind: ListKind, item: string) => {
    if (list && list.kind !== kind) {
      flushList()
    }
    list ??= { kind, items: [] }
    list.items.push(item)
  }

  for (const rawLine of input.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      continue
    }

    const bullet = line.match(BULLET)
    if (bullet) {
      pushItem('ul', bullet[1])
      continue
    }

    const numbered = line.match(NUMBERED)
    if (numbered) {
      pushItem('ol', numbered[1])
      continue
    }

    // A non-list line ends any run of list items before it.
    flushList()
    out.push(`<p>${inline(line)}</p>`)
  }

  flushList()

  return out.join('')
}

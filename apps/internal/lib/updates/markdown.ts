/**
 * The markdown an update item may use: **bold**, *italic*, [text](https://…),
 * and line breaks. Nothing else — headings, lists, images and raw HTML are
 * escaped as text — so what a session writes and what a client sees can't
 * drift, and nothing an author pastes can inject markup into the email.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Inline markdown only, whitespace left as-is. For callers that assemble a
 * line from fragments (e.g. around code spans) and need spaces preserved.
 */
export function inlineMarkdown(text: string): string {
  let out = escapeHtml(text)
  // Links first so their text can carry emphasis without re-parsing the href.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label: string, href: string) =>
      SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : match
  )
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return out
}

/** Paragraphs split on blank lines; single newlines become `<br>`. */
export function renderMarkdown(source: string): string {
  const paragraphs = source
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)

  return paragraphs
    .map(block => `<p>${inlineMarkdown(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Inline-only rendering for text that lives inside another element. */
export function renderInlineMarkdown(source: string): string {
  return inlineMarkdown(source.replace(/\s+/g, ' ').trim())
}

/** Plain-text counterpart for the email's text part. */
export function markdownToText(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .trim()
}

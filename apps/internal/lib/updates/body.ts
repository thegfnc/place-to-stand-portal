/**
 * The body of an update — greeting, intro, numbered items with a bold run-in,
 * the hours balance, closing — composed from the same rules for the email's
 * HTML part, its text part, and the composer's preview. The single portal
 * button is added outside the body by the shell. Pure: no server imports, so
 * the client-side preview can use it.
 *
 * The HTML carries structure only: items and the hours balance are marked with
 * `update-*` classes, which the email renderer inlines as mail-safe styles and
 * the preview styles in the app's theme. No colour lives here.
 */

import { escapeHtml, markdownToText, renderMarkdown } from './markdown'
import type { ClientUpdateItem } from './types'

export type UpdateBody = {
  /** Primary contact's first name; null renders "Hi there,". */
  greetingName: string | null
  intro: string
  items: ClientUpdateItem[]
  /** Prepaid balance; null for net-30 clients (no balance line). */
  hoursRemaining: number | null
  closing: string
}

export const DEFAULT_INTRO = "Here's an update on what we've been working on."
export const DEFAULT_CLOSING = 'Let me know if you have any questions.'

export function formatHours(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}

/** "Site speed" → "Site speed." — the run-in always ends the sentence. */
function runInLabel(label: string): string {
  return label.trim().replace(/\.?$/, '.')
}

function hoursLineText(remaining: number): string {
  return `You have ${formatHours(remaining)} remaining.`
}

/** Tables rather than divs for anything laid out side by side: mail clients drop flexbox. */
function itemHtml(item: ClientUpdateItem, index: number): string {
  const runIn = `<strong>${escapeHtml(runInLabel(item.label))}</strong>`
  const rendered = renderMarkdown(item.body)
  // Run the label into the first paragraph, as a person writing this would.
  const content = rendered
    ? rendered.replace(/^<p>/, `<p>${runIn} `)
    : `<p>${runIn}</p>`
  const number = String(index + 1).padStart(2, '0')

  return `<table role="presentation" class="update-item" cellpadding="0" cellspacing="0"><tr><td class="update-item-index">${number}</td><td class="update-item-body">${content}</td></tr></table>`
}

/** The balance is the thing the client scans for, so it gets its own row. */
function hoursHtml(remaining: number): string {
  return `<table role="presentation" class="update-hours" cellpadding="0" cellspacing="0"><tr><td class="update-hours-label">Prepaid hours remaining</td><td class="update-hours-value">${escapeHtml(formatHours(remaining))}</td></tr></table>`
}

export function composeBodyHtml(body: UpdateBody): string {
  const html: string[] = []

  html.push(`<p>Hi ${escapeHtml(body.greetingName ?? 'there')},</p>`)
  if (body.intro.trim()) html.push(renderMarkdown(body.intro))

  if (body.items.length > 0) {
    html.push(
      `<div class="update-items">${body.items.map(itemHtml).join('')}</div>`
    )
  }

  if (body.hoursRemaining !== null) {
    html.push(hoursHtml(body.hoursRemaining))
  }

  if (body.closing.trim()) html.push(renderMarkdown(body.closing))

  return html.join('\n')
}

export function composeBodyText(body: UpdateBody): string {
  const lines: string[] = [`Hi ${body.greetingName ?? 'there'},`, '']

  if (body.intro.trim()) lines.push(markdownToText(body.intro), '')

  body.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${runInLabel(item.label)} ${markdownToText(item.body)}`.trim(),
      ''
    )
  })

  if (body.hoursRemaining !== null)
    lines.push(hoursLineText(body.hoursRemaining), '')

  if (body.closing.trim()) lines.push(markdownToText(body.closing))

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Inbox preview line: the intro, or the item labels when there is none. */
export function previewLine(body: UpdateBody): string {
  const source =
    body.intro.trim() || body.items.map(item => item.label).join(' · ')
  return markdownToText(source).slice(0, 140)
}

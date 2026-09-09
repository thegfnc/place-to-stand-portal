/**
 * The body of an update — greeting, intro, numbered items with a bold run-in,
 * the hours line, closing — composed from the same rules for the email's HTML
 * part, its text part, and the composer's preview. The single portal button
 * is added outside the body by the shell. Pure: no server imports, so the
 * client-side preview can use it.
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

/** The number is the thing the client scans for, so it is bold in HTML. */
function hoursLineHtml(remaining: number): string {
  return `You have <strong>${escapeHtml(formatHours(remaining))}</strong> remaining.`
}

export function composeBodyHtml(body: UpdateBody): string {
  const html: string[] = []

  html.push(`<p>Hi ${escapeHtml(body.greetingName ?? 'there')},</p>`)
  if (body.intro.trim()) html.push(renderMarkdown(body.intro))

  body.items.forEach((item, index) => {
    const runIn = `<strong>${index + 1}. ${escapeHtml(runInLabel(item.label))}</strong>`
    const rendered = renderMarkdown(item.body)
    // Run the label into the first paragraph, as a person writing this would.
    html.push(
      rendered ? rendered.replace(/^<p>/, `<p>${runIn} `) : `<p>${runIn}</p>`
    )
  })

  if (body.hoursRemaining !== null) {
    html.push(`<p>${hoursLineHtml(body.hoursRemaining)}</p>`)
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

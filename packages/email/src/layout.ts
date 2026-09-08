/**
 * Shared shell for transactional email.
 *
 * Auth mail used to come from two places — our own invite template and
 * Supabase's stock templates — which is why a password reset looked nothing
 * like an invite and landed in spam. Everything we send now renders through
 * here so the visual language, sender identity and footer are the same message
 * to message.
 */

/** Wordmark and signature. Kept here so no template hard-codes the brand. */
const BRAND = 'Place To Stand'

const COLORS = {
  ink: '#0f172a',
  muted: '#475569',
  faint: '#94a3b8',
  rule: '#e2e8f0',
  paper: '#ffffff',
  backdrop: '#f8fafc',
} as const

/**
 * Interpolated values reach the HTML part as markup, so anything originating
 * with a user — a display name, an address they typed — is escaped. The plain
 * text part needs no equivalent because it is never parsed.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type EmailAction = {
  label: string
  url: string
}

/**
 * Renders a link lifetime as a phrase. Callers pass Supabase's configured
 * `otp_expiry` rather than a literal, so the copy can't promise a window the
 * token doesn't actually have.
 */
export function formatExpiryWindow(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`

  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

export type EmailLayoutArgs = {
  /** Shown as the inbox preview line. Never rendered in the body. */
  preheader: string
  heading: string
  /** Body copy, one entry per paragraph. Plain strings — escaped for you. */
  paragraphs: string[]
  action?: EmailAction
  /** Small print under the action, e.g. link expiry. Escaped. */
  note?: string
  /**
   * Lead-in to the footer line; `replyTo` is appended as the address, so pass
   * the sentence up to but not including it.
   *
   * The default suits mail you can safely disregard. A message reporting a
   * change that has already happened should override it — telling someone their
   * password just changed and then that they can ignore the message is the
   * opposite of the advice they need.
   */
  footerLead?: string
  /** Address a confused recipient should write to. */
  replyTo: string
}

const DEFAULT_FOOTER_LEAD =
  "If you weren't expecting this message you can ignore it, or reply to"

export type RenderedEmail = {
  subject: string
  text: string
  html: string
}

/**
 * Both parts are built from the same content so they can't drift.
 *
 * A password reset with a link and almost no prose is the exact shape of a
 * phishing message, which is most of why Supabase's stock template got
 * classified as one. The layout deliberately carries real sender identity and
 * a plain-language explanation rather than a bare button.
 */
export function renderEmail(
  subject: string,
  {
    preheader,
    heading,
    paragraphs,
    action,
    note,
    footerLead,
    replyTo,
  }: EmailLayoutArgs
): RenderedEmail {
  return {
    subject,
    text: renderText({
      heading,
      paragraphs,
      action,
      note,
      footerLead,
      replyTo,
    }),
    html: renderHtml({
      preheader,
      heading,
      paragraphs,
      action,
      note,
      footerLead,
      replyTo,
    }),
  }
}

function renderText({
  heading,
  paragraphs,
  action,
  note,
  footerLead,
  replyTo,
}: Omit<EmailLayoutArgs, 'preheader'>): string {
  const lines = [heading, '', ...paragraphs.flatMap(p => [p, ''])]

  if (action) {
    lines.push(`${action.label}: ${action.url}`, '')
  }

  if (note) {
    lines.push(note, '')
  }

  lines.push(
    `${footerLead ?? DEFAULT_FOOTER_LEAD} ${replyTo}.`,
    '',
    `— The ${BRAND} Team`
  )

  return lines.join('\n')
}

function renderHtml({
  preheader,
  heading,
  paragraphs,
  action,
  note,
  footerLead,
  replyTo,
}: EmailLayoutArgs): string {
  const body = paragraphs
    .map(
      text =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(text)}</p>`
    )
    .join('')

  const { button, fallback } = renderAction(action)

  const smallPrint = note
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(note)}</p>`
    : ''

  return renderShell({
    preheader,
    inner: `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${COLORS.ink};">${escapeHtml(heading)}</h1>
                ${body}
                ${button}
                ${fallback}
                ${smallPrint}`,
    footerLead,
    replyTo,
  })
}

/**
 * The call-to-action, plus the raw URL under it: some clients strip the
 * button, and a link-only message reads as phishing to spam filters.
 * `href` is ours, never user input, but attribute-escaped anyway.
 */
function renderAction(action?: EmailAction): {
  button: string
  fallback: string
} {
  if (!action) return { button: '', fallback: '' }
  return {
    button: `<p style="margin:24px 0;">
         <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 22px;background:${COLORS.ink};color:${COLORS.paper};border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(action.label)}</a>
       </p>`,
    fallback: `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${COLORS.muted};">
         Or paste this into your browser:<br />
         <span style="color:${COLORS.faint};word-break:break-all;">${escapeHtml(action.url)}</span>
       </p>`,
  }
}

type ShellArgs = {
  preheader: string
  /** Already-rendered HTML placed inside the card, under the wordmark. */
  inner: string
  footerLead?: string
  replyTo: string
}

/**
 * The card itself — backdrop, paper, wordmark, rule, footer — shared by the
 * paragraph layout and the rich-body layout so every message from us looks
 * like the same sender.
 */
function renderShell({
  preheader,
  inner,
  footerLead,
  replyTo,
}: ShellArgs): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.backdrop};">
    <span style="display:none;font-size:1px;color:${COLORS.backdrop};max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.backdrop};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.paper};border:1px solid ${COLORS.rule};border-radius:10px;">
            <tr>
              <td style="padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 24px;font-size:14px;font-weight:700;letter-spacing:0.02em;color:${COLORS.ink};">${BRAND}</p>
                ${inner}
                <hr style="border:none;border-top:1px solid ${COLORS.rule};margin:24px 0;" />
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${COLORS.muted};">
                  ${escapeHtml(footerLead ?? DEFAULT_FOOTER_LEAD)}
                  <a href="mailto:${escapeHtml(replyTo)}" style="color:${COLORS.muted};">${escapeHtml(replyTo)}</a>.
                </p>
                <p style="margin:0;font-size:13px;color:${COLORS.faint};">— The ${BRAND} Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * Inline rules for the tags a rich-text editor emits. Mail clients drop most
 * of a stylesheet, so each block carries its own; colours match the paragraph
 * layout above so a rich message and a transactional one read as one brand.
 */
const RICH_BLOCK_STYLES: Record<string, string> = {
  h1: `margin:24px 0 8px;font-size:20px;line-height:1.3;font-weight:600;color:${COLORS.ink};`,
  h2: `margin:24px 0 8px;font-size:17px;line-height:1.3;font-weight:600;color:${COLORS.ink};`,
  h3: `margin:20px 0 6px;font-size:15px;line-height:1.3;font-weight:600;color:${COLORS.ink};`,
  p: `margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.ink};`,
  ul: `margin:0 0 18px;padding-left:22px;`,
  ol: `margin:0 0 12px;padding-left:22px;`,
  li: `margin:0 0 6px;font-size:15px;line-height:1.6;color:${COLORS.ink};`,
  blockquote: `margin:0 0 12px;padding-left:12px;border-left:3px solid ${COLORS.rule};color:${COLORS.muted};`,
  a: `color:${COLORS.ink};`,
}

export type RichEmailLayoutArgs = {
  /** Shown as the inbox preview line. Never rendered in the body. */
  preheader: string
  /**
   * Trusted, already-sanitized HTML — the editor's own output, not user
   * input from outside. Rendered as-is with inline block styles applied.
   */
  bodyHtml: string
  /** Plain text alternative for the same content. */
  bodyText: string
  /** Optional button after the body, same treatment as `renderEmail`. */
  action?: EmailAction
  footerLead?: string
  replyTo: string
}

/**
 * Same shell as `renderEmail`, for a body authored in a rich-text editor
 * rather than assembled from paragraphs — a client status update, say.
 */
export function renderRichEmail(
  subject: string,
  {
    preheader,
    bodyHtml,
    bodyText,
    action,
    footerLead,
    replyTo,
  }: RichEmailLayoutArgs
): RenderedEmail {
  const styled = bodyHtml.replace(
    /<(h1|h2|h3|p|ul|ol|li|blockquote|a)(\s[^>]*)?>/gi,
    (match, tag: string, attrs = '') => {
      // Leave any existing style attribute alone rather than doubling up.
      if (/\sstyle=/i.test(attrs)) return match
      const name = tag.toLowerCase()
      return `<${name}${attrs} style="${RICH_BLOCK_STYLES[name]}">`
    }
  )

  const { button, fallback } = renderAction(action)
  const lead = footerLead ?? DEFAULT_FOOTER_LEAD
  const text = [
    bodyText,
    '',
    ...(action ? [`${action.label}: ${action.url}`, ''] : []),
    `${lead} ${replyTo}.`,
    '',
    `— The ${BRAND} Team`,
  ].join('\n')

  return {
    subject,
    text,
    html: renderShell({
      preheader,
      inner: `${styled}${button}${fallback}`,
      footerLead,
      replyTo,
    }),
  }
}

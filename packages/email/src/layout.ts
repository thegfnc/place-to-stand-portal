/**
 * Shared shell for transactional email.
 *
 * Auth mail used to come from two places — our own invite template and
 * Supabase's stock templates — which is why a password reset looked nothing
 * like an invite and landed in spam. Everything we send now renders through
 * here so the visual language, sender identity and footer are the same message
 * to message.
 *
 * The look is the marketing site's: a dark masthead carrying the blueprint
 * mark, over a paper body. The body stays light on purpose — Gmail and Outlook
 * rewrite dark message backgrounds in dark mode, and a light body prints clean.
 */

/** Wordmark. Kept here so no template hard-codes the brand. */
const BRAND = 'Place To Stand'
const SITE_URL = 'https://placetostandagency.com'
const SITE_LABEL = 'placetostandagency.com'

/**
 * Brand hex values, restated from `@pts/ui/brand` because this package carries
 * no React dependency. `accentInk` is lime-700: the accent where it has to hold
 * contrast on paper, since the brand lime all but vanishes on white.
 */
export const EMAIL_COLORS = {
  ink: '#0e0f11',
  muted: '#5b5d63',
  faint: '#6e7078',
  rule: '#e2e2de',
  paper: '#ffffff',
  backdrop: '#f4f4f2',
  mastheadText: '#e8e6e3',
  accent: '#b5f542',
  accentFrame: 'rgba(181, 245, 66, 0.5)',
  accentInk: '#4d7c0f',
} as const

/**
 * Space Grotesk and Geist Mono load from Google Fonts where the client allows
 * it (Apple Mail, iOS); everywhere else the fallbacks carry the same weights.
 */
export const EMAIL_FONTS = {
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  head: "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const

const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Geist+Mono:wght@500&display=swap'

const C = EMAIL_COLORS
const F = EMAIL_FONTS

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
  /** Short mono tag on the right of the masthead, e.g. "Sign-in link". */
  label?: string
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
    label,
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
    text: renderText({ heading, paragraphs, action, note, footerLead, replyTo }),
    html: renderHtml({
      preheader,
      label,
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
}: Omit<EmailLayoutArgs, 'preheader' | 'label'>): string {
  const lines = [heading, '', ...paragraphs.flatMap(p => [p, ''])]

  if (action) {
    lines.push(`${action.label}: ${action.url}`, '')
  }

  if (note) {
    lines.push(note, '')
  }

  lines.push(`${footerLead ?? DEFAULT_FOOTER_LEAD} ${replyTo}.`)

  return lines.join('\n')
}

function renderHtml({
  preheader,
  label,
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
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.ink};">${escapeHtml(text)}</p>`
    )
    .join('')

  const { button, fallback } = renderAction(action)

  const smallPrint = note
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${C.muted};">${escapeHtml(note)}</p>`
    : ''

  return renderShell({
    preheader,
    label,
    inner: `<h1 style="margin:0 0 16px;font-family:${F.head};font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(heading)}</h1>
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
    button: `<p style="margin:28px 0 24px;">
         <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 28px;background:${C.ink};border:1px solid ${C.ink};color:${C.accent};text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(action.label)}</a>
       </p>`,
    fallback: `<p style="margin:0 0 16px;font-family:${F.mono};font-size:12px;line-height:1.6;color:${C.muted};">
         Or paste this into your browser:<br />
         <span style="color:${C.faint};word-break:break-all;">${escapeHtml(action.url)}</span>
       </p>`,
  }
}

/**
 * The blueprint mark (a framed square holding an accent dot) beside the
 * wordmark, built from table cells because mail clients drop flexbox.
 */
const LOGO = `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="20" height="20" style="width:20px;height:20px;border:1px solid ${C.accentFrame};text-align:center;vertical-align:middle;font-size:0;line-height:0;">
                      <span style="display:inline-block;width:8px;height:8px;background:${C.accent};"></span>
                    </td>
                    <td style="padding-left:10px;font-family:${F.head};font-size:18px;line-height:1;font-weight:700;letter-spacing:-0.025em;color:${C.mastheadText};">${BRAND}</td>
                  </tr>
                </table>`

type ShellArgs = {
  preheader: string
  label?: string
  /** Already-rendered HTML placed inside the card, under the masthead. */
  inner: string
  footerLead?: string
  replyTo: string
}

/**
 * The card itself — backdrop, masthead, paper, rule, footer — shared by the
 * paragraph layout and the rich-body layout so every message from us looks
 * like the same sender.
 */
function renderShell({
  preheader,
  label,
  inner,
  footerLead,
  replyTo,
}: ShellArgs): string {
  const tag = label
    ? `<td align="right" style="vertical-align:middle;font-family:${F.mono};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent};">${escapeHtml(label)}</td>`
    : ''

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <link rel="stylesheet" href="${FONT_STYLESHEET}" />
  </head>
  <body style="margin:0;padding:0;background:${C.backdrop};">
    <span style="display:none;font-size:1px;color:${C.backdrop};max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.backdrop};padding:40px 16px 32px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.paper};border:1px solid ${C.rule};">
            <tr>
              <td style="background:${C.ink};padding:20px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">${LOGO}</td>
                    ${tag}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px 28px;font-family:${F.body};">
                ${inner}
                <hr style="border:none;border-top:1px solid ${C.rule};margin:24px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted};">
                  ${escapeHtml(footerLead ?? DEFAULT_FOOTER_LEAD)}
                  <a href="mailto:${escapeHtml(replyTo)}" style="color:${C.ink};text-decoration:underline;">${escapeHtml(replyTo)}</a>.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-family:${F.mono};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${C.faint};">
            ${BRAND} · <a href="${SITE_URL}" style="color:${C.faint};text-decoration:none;">${SITE_LABEL}</a>
          </p>
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
  h1: `margin:24px 0 8px;font-family:${F.head};font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${C.ink};`,
  h2: `margin:24px 0 8px;font-family:${F.head};font-size:18px;line-height:1.3;font-weight:700;color:${C.ink};`,
  h3: `margin:20px 0 6px;font-size:15px;line-height:1.3;font-weight:600;color:${C.ink};`,
  p: `margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.ink};`,
  ul: `margin:0 0 18px;padding-left:22px;`,
  ol: `margin:0 0 12px;padding-left:22px;`,
  li: `margin:0 0 6px;font-size:15px;line-height:1.6;color:${C.ink};`,
  blockquote: `margin:0 0 12px;padding-left:12px;border-left:3px solid ${C.rule};color:${C.muted};`,
  a: `color:${C.ink};text-decoration:underline;`,
}

export type RichEmailLayoutArgs = {
  /** Shown as the inbox preview line. Never rendered in the body. */
  preheader: string
  /** Short mono tag on the right of the masthead, e.g. "Update · Acme Co.". */
  label?: string
  /**
   * Trusted, already-sanitized HTML — the editor's own output, not user
   * input from outside. Rendered as-is with inline block styles applied.
   */
  bodyHtml: string
  /** Plain text alternative for the same content. */
  bodyText: string
  /**
   * Inline styles for elements the body marks with a class, keyed by the exact
   * `class` value — for structure the tag rules can't express, like the update
   * email's numbered items. A class rule wins over the element's tag rule.
   */
  classStyles?: Record<string, string>
  /** Optional button after the body, same treatment as `renderEmail`. */
  action?: EmailAction
  footerLead?: string
  replyTo: string
}

/**
 * Applies the tag and class rules to every opening tag that doesn't already
 * carry a `style` attribute (left alone rather than doubled up).
 */
function inlineStyles(
  html: string,
  classStyles: Record<string, string>
): string {
  return html.replace(
    /<([a-z][a-z0-9]*)(\s[^>]*)?>/gi,
    (match, tag: string, attrs = '') => {
      if (/\sstyle=/i.test(attrs)) return match
      const name = tag.toLowerCase()
      const className = /\sclass="([^"]*)"/i.exec(attrs)?.[1]
      const style =
        (className ? classStyles[className] : undefined) ??
        RICH_BLOCK_STYLES[name]
      if (!style) return match
      return `<${name}${attrs} style="${style}">`
    }
  )
}

/**
 * Same shell as `renderEmail`, for a body authored in a rich-text editor
 * rather than assembled from paragraphs — a client status update, say.
 */
export function renderRichEmail(
  subject: string,
  {
    preheader,
    label,
    bodyHtml,
    bodyText,
    classStyles = {},
    action,
    footerLead,
    replyTo,
  }: RichEmailLayoutArgs
): RenderedEmail {
  const { button, fallback } = renderAction(action)
  const lead = footerLead ?? DEFAULT_FOOTER_LEAD
  const text = [
    bodyText,
    '',
    ...(action ? [`${action.label}: ${action.url}`, ''] : []),
    `${lead} ${replyTo}.`,
  ].join('\n')

  return {
    subject,
    text,
    html: renderShell({
      preheader,
      label,
      inner: `${inlineStyles(bodyHtml, classStyles)}${button}${fallback}`,
      footerLead,
      replyTo,
    }),
  }
}

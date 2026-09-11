import {
  EMAIL_COLORS as C,
  EMAIL_FONTS as F,
  renderRichEmail,
  type RenderedEmail,
} from '@pts/email'

import {
  composeBodyHtml,
  composeBodyText,
  previewLine,
  type UpdateBody,
} from './body'
import { PORTAL_BUTTON_LABEL, UPDATE_EMAIL_FOOTER_LEAD } from './branding'

export type UpdateEmailContent = UpdateBody & {
  subject: string
  /** Named in the masthead tag: "Update · Acme Co.". */
  clientName: string
  /** The single call-to-action under the body. */
  portalHref: string
  replyTo: string
}

/**
 * Inline styles for the classes `composeBodyHtml` marks its structure with.
 * The body itself stays presentation-free because the composer preview renders
 * the same markup in the app's theme (see `update-preview.tsx`).
 */
const UPDATE_CLASS_STYLES: Record<string, string> = {
  'update-items': `margin:4px 0 24px;border-bottom:1px solid ${C.rule};`,
  'update-item': `width:100%;border-collapse:collapse;border-top:1px solid ${C.rule};`,
  'update-item-index': `width:32px;padding:16px 0;vertical-align:top;font-family:${F.mono};font-size:12px;line-height:24px;color:${C.accentInk};`,
  'update-item-body': `padding:16px 0 4px;vertical-align:top;`,
  'update-hours': `width:100%;border-collapse:collapse;margin:0 0 24px;border:1px solid ${C.rule};background:${C.backdrop};`,
  'update-hours-label': `padding:16px 20px;vertical-align:middle;font-family:${F.mono};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${C.muted};`,
  'update-hours-value': `padding:16px 20px;vertical-align:middle;text-align:right;white-space:nowrap;font-family:${F.head};font-size:22px;line-height:1;font-weight:700;letter-spacing:-0.02em;color:${C.ink};`,
}

/** The update inside the branded card, HTML and text parts from one source. */
export function renderUpdateEmail(content: UpdateEmailContent): RenderedEmail {
  return renderRichEmail(content.subject, {
    preheader: previewLine(content),
    label: `Update · ${content.clientName}`,
    bodyHtml: composeBodyHtml(content),
    bodyText: composeBodyText(content),
    classStyles: UPDATE_CLASS_STYLES,
    action: { label: PORTAL_BUTTON_LABEL, url: content.portalHref },
    footerLead: UPDATE_EMAIL_FOOTER_LEAD,
    replyTo: content.replyTo,
  })
}

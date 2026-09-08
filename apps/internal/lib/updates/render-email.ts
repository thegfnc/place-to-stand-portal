import { renderRichEmail, type RenderedEmail } from '@pts/email'

import {
  composeBodyHtml,
  composeBodyText,
  previewLine,
  type UpdateBody,
} from './body'
import { PORTAL_BUTTON_LABEL, UPDATE_EMAIL_FOOTER_LEAD } from './branding'

export type UpdateEmailContent = UpdateBody & {
  subject: string
  /** The single call-to-action under the body. */
  portalHref: string
  replyTo: string
}

/** The update inside the branded card, HTML and text parts from one source. */
export function renderUpdateEmail(content: UpdateEmailContent): RenderedEmail {
  return renderRichEmail(content.subject, {
    preheader: previewLine(content),
    bodyHtml: composeBodyHtml(content),
    bodyText: composeBodyText(content),
    action: { label: PORTAL_BUTTON_LABEL, url: content.portalHref },
    footerLead: UPDATE_EMAIL_FOOTER_LEAD,
    replyTo: content.replyTo,
  })
}

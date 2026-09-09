import 'server-only'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { BadRequestError } from '@/lib/errors/http'
import {
  OAuthReconnectRequiredError,
  sendEmail,
  type SendEmailParams,
  type SendEmailResult,
} from '@/lib/gmail/client'

import { buildUpdateEmailContent } from './content'
import { fetchClientUpdate, markClientUpdateSent } from './queries'
import { renderUpdateEmail } from './render-email'
import type { ClientUpdateRow } from './types'

export const RECONNECT_GOOGLE_MESSAGE =
  'Your Google account needs to be reconnected before this can be sent. Go to Settings → Integrations.'

/**
 * Sends the draft, as it would go out, to the admin pressing the button —
 * nobody else, no cc — and leaves the row untouched. For checking rendering
 * in a real inbox before the client sees it. The sender's own address is the
 * one mailbox guaranteed to exist: they connected Gmail to send at all.
 */
export async function sendClientUpdateTest(
  user: AppUser,
  id: string
): Promise<{ to: string }> {
  assertAdmin(user)

  const update = await fetchClientUpdate(id)
  if (update.items.length === 0) {
    throw new BadRequestError('Add at least one item before sending a test.')
  }

  const content = await buildUpdateEmailContent(user, update)
  const { html, text } = renderUpdateEmail({
    ...content,
    subject: `[Test] ${content.subject}`,
  })

  await deliver(user, {
    to: [user.email],
    subject: `[Test] ${content.subject}`,
    bodyHtml: html,
    bodyText: text,
  })

  return { to: user.email }
}

/**
 * Sends a draft through the acting admin's Gmail and records the result.
 * The email is rendered from the row at this moment — links and the hours
 * balance are live, not stored.
 */
export async function sendClientUpdate(
  user: AppUser,
  id: string
): Promise<ClientUpdateRow> {
  assertAdmin(user)

  const update = await fetchClientUpdate(id)

  if (update.status !== 'DRAFT') {
    throw new BadRequestError('This update has already been sent.')
  }
  if (update.recipients.to.length === 0) {
    throw new BadRequestError('Add at least one recipient before sending.')
  }
  if (!update.subject.trim()) {
    throw new BadRequestError('Add a subject before sending.')
  }
  if (update.items.length === 0) {
    throw new BadRequestError('Add at least one item before sending.')
  }

  const { html, text } = renderUpdateEmail(
    await buildUpdateEmailContent(user, update)
  )

  let sent
  try {
    sent = await sendEmail(user.id, {
      to: update.recipients.to,
      cc: update.recipients.cc,
      subject: update.subject,
      bodyHtml: html,
      bodyText: text,
    })
  } catch (error) {
    if (error instanceof OAuthReconnectRequiredError) {
      throw new BadRequestError(RECONNECT_GOOGLE_MESSAGE)
    }
    if (
      error instanceof Error &&
      error.message === 'Google account not connected'
    ) {
      throw new BadRequestError(RECONNECT_GOOGLE_MESSAGE)
    }
    throw error
  }

  return markClientUpdateSent(id, {
    sentById: user.id,
    gmailMessageId: sent.id,
    gmailThreadId: sent.threadId,
  })
}

/** Gmail send with the connection failures turned into a message a person can act on. */
async function deliver(
  user: AppUser,
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    return await sendEmail(user.id, params)
  } catch (error) {
    if (error instanceof OAuthReconnectRequiredError) {
      throw new BadRequestError(RECONNECT_GOOGLE_MESSAGE)
    }
    if (
      error instanceof Error &&
      error.message === 'Google account not connected'
    ) {
      throw new BadRequestError(RECONNECT_GOOGLE_MESSAGE)
    }
    throw error
  }
}

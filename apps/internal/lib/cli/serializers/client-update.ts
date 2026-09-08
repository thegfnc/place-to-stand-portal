import { updateComposerHref } from '@/lib/sheets/hrefs'
import type { ClientUpdateRow } from '@/lib/updates/types'

export type CliClientUpdate = {
  id: string
  clientId: string
  status: ClientUpdateRow['status']
  subject: string
  intro: string
  items: ClientUpdateRow['items']
  closing: string
  periodStart: string
  periodEnd: string
  recipients: ClientUpdateRow['recipients']
  sentAt: string | null
  gmailThreadId: string | null
  /** Portal path to the composer; the CLI joins it to its API base URL. */
  path: string
  createdAt: string
  updatedAt: string
}

export function serializeClientUpdate(
  update: ClientUpdateRow
): CliClientUpdate {
  return {
    id: update.id,
    clientId: update.clientId,
    status: update.status,
    subject: update.subject,
    intro: update.intro,
    items: update.items,
    closing: update.closing,
    periodStart: update.periodStart,
    periodEnd: update.periodEnd,
    recipients: update.recipients,
    sentAt: update.sentAt,
    gmailThreadId: update.gmailThreadId,
    path: updateComposerHref(update.id),
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
  }
}

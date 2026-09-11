import 'server-only'

import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'

import type { AppUser } from '@/lib/auth/session'
import { fetchClientById } from '@/lib/data/clients'
import { db } from '@/lib/db'
import { fetchContactsForClient } from '@/lib/queries/clients/contacts'

import { greetingNameFromContacts } from './default-recipients'
import { portalHomeHref } from './links'
import type { UpdateEmailContent } from './render-email'
import type { ClientUpdateRow } from './types'

/**
 * Everything the renderer needs beyond the row itself — greeting, live hours
 * balance, the portal link — resolved once so the composer preview and the
 * send path can't disagree about what the email says.
 */
export async function buildUpdateEmailContent(
  user: AppUser,
  update: ClientUpdateRow
): Promise<UpdateEmailContent> {
  const [client, contacts, hoursByClient] = await Promise.all([
    fetchClientById(user, update.clientId),
    fetchContactsForClient(update.clientId),
    getClientHoursTotals(db, [update.clientId]),
  ])

  const prepaid = client.billingType === 'prepaid'

  return {
    subject: update.subject,
    clientName: client.name,
    greetingName: greetingNameFromContacts(contacts),
    intro: update.intro,
    items: update.items,
    hoursRemaining: prepaid
      ? clientHoursTotalsFor(hoursByClient, client.id).remaining
      : null,
    closing: update.closing,
    portalHref: portalHomeHref(),
    replyTo: user.email,
  }
}

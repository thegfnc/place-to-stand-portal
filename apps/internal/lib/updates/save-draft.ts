import 'server-only'

import { clientUpdateEditedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import type { ActivitySourceValue } from '@/lib/types'

import { fetchClientUpdate, updateClientUpdateDraft } from './queries'
import type {
  ClientUpdateItem,
  ClientUpdateRecipients,
  ClientUpdateRow,
} from './types'

export type SaveUpdateDraftInput = {
  subject: string
  intro: string
  items: ClientUpdateItem[]
  closing: string
  recipients: ClientUpdateRecipients
}

/**
 * Saves an edited draft and records what changed. Shared by every writer so a
 * save from the composer and a future CLI edit leave the same activity row.
 * A save that changes nothing still returns the row but logs nothing.
 */
export async function saveUpdateDraft(
  user: AppUser,
  id: string,
  input: SaveUpdateDraftInput,
  options: { source?: ActivitySourceValue } = {}
): Promise<ClientUpdateRow> {
  assertAdmin(user)

  const before = await fetchClientUpdate(id)
  const updated = await updateClientUpdateDraft(id, input)
  const diff = diffDraft(before, updated)

  if (diff.changedFields.length === 0) {
    return updated
  }

  const event = clientUpdateEditedEvent({
    subject: updated.subject,
    changedFields: diff.changedFields,
    details: diff.details,
    recipientChanges: diff.recipientChanges,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    source: options.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CLIENT_UPDATE',
    targetId: updated.id,
    targetClientId: updated.clientId,
    metadata: event.metadata,
  })

  return updated
}

type DraftDiff = {
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
  recipientChanges?: { added: string[]; removed: string[] }
}

function diffDraft(before: ClientUpdateRow, after: ClientUpdateRow): DraftDiff {
  const changedFields: string[] = []
  const previous: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}

  for (const field of ['subject', 'intro', 'closing'] as const) {
    if (before[field] !== after[field]) {
      changedFields.push(field)
      previous[field] = before[field]
      next[field] = after[field]
    }
  }

  // Items carry up to 5000 chars of body each; the log keeps the labels so the
  // feed can show what was added, removed, or renamed without storing prose.
  if (JSON.stringify(before.items) !== JSON.stringify(after.items)) {
    changedFields.push('items')
    previous.items = before.items.map(item => item.label)
    next.items = after.items.map(item => item.label)
  }

  const beforeRecipients = allRecipients(before.recipients)
  const afterRecipients = allRecipients(after.recipients)
  const added = afterRecipients.filter(email => !beforeRecipients.includes(email))
  const removed = beforeRecipients.filter(
    email => !afterRecipients.includes(email)
  )
  // to <-> cc moves change neither list's membership, so compare the split too.
  const recipientsChanged =
    added.length > 0 ||
    removed.length > 0 ||
    JSON.stringify(before.recipients) !== JSON.stringify(after.recipients)

  if (recipientsChanged) {
    changedFields.push('recipients')
    previous.recipients = before.recipients
    next.recipients = after.recipients
  }

  return {
    changedFields,
    details: { before: previous, after: next },
    recipientChanges:
      added.length > 0 || removed.length > 0 ? { added, removed } : undefined,
  }
}

function allRecipients(recipients: ClientUpdateRecipients): string[] {
  return [...recipients.to, ...recipients.cc]
}

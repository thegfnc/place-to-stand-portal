import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { clientUpdateDraftedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { resolveClientIdentifier } from '@/lib/data/clients'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { BadRequestError } from '@/lib/errors/http'
import { fetchContactsForClient } from '@/lib/queries/clients/contacts'
import type { ActivitySourceValue } from '@/lib/types'

import { scaffoldItems } from './assemble'
import { recipientsFromContacts } from './default-recipients'
import { createClientUpdate } from './queries'
import { fetchActiveStaff } from './staff'
import { DEFAULT_CLOSING, DEFAULT_INTRO } from './body'
import type { ClientUpdateItem, ClientUpdateRow } from './types'
import { resolveUpdateWindow } from './window'

/** An item as the CLI supplies it: the task is optional and by id. */
export type DraftItemInput = {
  taskId?: string | null
  label: string
  body?: string
}

type CreateUpdateDraftInput = {
  /** Client UUID or slug. */
  clientRef: string
  /** Override the window start as YYYY-MM-DD. */
  since?: string | null
  subject?: string | null
  intro?: string | null
  /**
   * The session's own account of the work. When omitted the draft is
   * scaffolded from tasks that moved in the window, with empty bodies.
   */
  items?: DraftItemInput[] | null
  closing?: string | null
  /** Where the request came from, for the activity log. Defaults to the admin UI. */
  source?: ActivitySourceValue
}

/**
 * The one entry point for starting an update, shared by the CLI route and the
 * client page button so both produce identical drafts (and identical activity
 * rows — the log lives here so the two callers cannot diverge).
 */
export async function createUpdateDraft(
  user: AppUser,
  input: CreateUpdateDraftInput
): Promise<ClientUpdateRow> {
  assertAdmin(user)

  const client = await resolveClientIdentifier(user, input.clientRef)
  const clientId = client.resolvedId
  const window = await resolveUpdateWindow(clientId, input.since)

  const [contacts, staff, items] = await Promise.all([
    fetchContactsForClient(clientId),
    fetchActiveStaff(),
    input.items?.length
      ? materializeItems(clientId, input.items)
      : scaffoldItems(user, clientId, window),
  ])

  const update = await createClientUpdate({
    clientId,
    subject: input.subject?.trim() || `${client.name} updates`,
    intro: input.intro ?? DEFAULT_INTRO,
    items,
    closing: input.closing ?? DEFAULT_CLOSING,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    recipients: recipientsFromContacts(contacts, staff, user.id),
    createdById: user.id,
  })

  const event = clientUpdateDraftedEvent({
    clientName: client.name,
    subject: update.subject,
    recipients: update.recipients,
    itemCount: update.items.length,
    periodStart: update.periodStart,
    periodEnd: update.periodEnd,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    source: input.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CLIENT_UPDATE',
    targetId: update.id,
    targetClientId: clientId,
    metadata: event.metadata,
  })

  return update
}

/**
 * Give supplied items stable ids and make sure every referenced task really
 * belongs to this client — a link to someone else's task would be worse than
 * no link.
 */
async function materializeItems(
  clientId: string,
  inputs: DraftItemInput[]
): Promise<ClientUpdateItem[]> {
  const taskIds = inputs
    .map(item => item.taskId)
    .filter((id): id is string => !!id)

  if (taskIds.length > 0) {
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          inArray(tasks.id, taskIds),
          eq(projects.clientId, clientId),
          isNull(tasks.deletedAt)
        )
      )
    const known = new Set(rows.map(row => row.id))
    const missing = taskIds.filter(id => !known.has(id))
    if (missing.length > 0) {
      throw new BadRequestError(
        `Task${missing.length > 1 ? 's' : ''} not found for this client: ${missing.join(', ')}`
      )
    }
  }

  return inputs.map(item => ({
    id: crypto.randomUUID(),
    taskId: item.taskId ?? null,
    label: item.label.trim(),
    body: item.body?.trim() ?? '',
  }))
}

import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientUpdatedEvent } from '@/lib/activity/events'
import type { UserRole } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, clients } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import {
  clientSlugExists,
  syncClientMembers,
  toClientSlug,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

type UpdateClientPayload = {
  id: string
  name: string
  providedSlug: string | null
  billingType: ClientBillingTypeValue
  notes: string | null
  memberIds: string[]
}

type ExistingClientRecord = {
  id: string
  name: string
  slug: string | null
  billingType: ClientBillingTypeValue
  notes: string | null
}

export async function updateClient(
  context: ClientMutationContext,
  payload: UpdateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const { id, name, providedSlug, billingType, notes, memberIds } = payload

  const slugToUpdate = providedSlug ? toClientSlug(providedSlug) : null

  if (slugToUpdate && slugToUpdate.length < 3) {
    return buildMutationResult({ error: 'Slug must be at least 3 characters.' })
  }

  if (slugToUpdate) {
    const exists = await clientSlugExists(slugToUpdate, {
      excludeId: id,
    })

    if (exists) {
      return buildMutationResult({
        error: 'Another client already uses this slug.',
      })
    }
  }

  let existingClient: ExistingClientRecord | undefined = undefined

  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        billingType: clients.billingType,
        notes: clients.notes,
      })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1)

    existingClient = rows[0]
  } catch (error) {
    console.error('Failed to load client for update', error)
    return buildMutationResult({ error: 'Unable to update client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  let existingMemberIds: string[] = []

  try {
    const memberRows = await db
      .select({ userId: clientMembers.userId })
      .from(clientMembers)
      .where(
        and(eq(clientMembers.clientId, id), isNull(clientMembers.deletedAt))
      )

    existingMemberIds = memberRows.map(member => member.userId)
  } catch (error) {
    console.error('Failed to load client members', error)
    return buildMutationResult({ error: 'Unable to update client members.' })
  }

  try {
    await db
      .update(clients)
      .set({ name, slug: slugToUpdate, billingType, notes })
      .where(eq(clients.id, id))
  } catch (error) {
    console.error('Failed to update client', error)
    return buildMutationResult({
      error:
        error instanceof Error ? error.message : 'Unable to update client.',
    })
  }

  const syncResult = await syncClientMembers(id, memberIds)

  if (syncResult.error) {
    return buildMutationResult(syncResult)
  }

  await recordUpdateActivity({
    userContext: { id: user.id, role: user.role },
    existingClient,
    updatedValues: { name, notes, slugToUpdate, billingType },
    existingMemberIds,
    nextMemberIds: memberIds,
  })

  return buildMutationResult({})
}

type RecordUpdateActivityArgs = {
  userContext: {
    id: string
    role: UserRole
  }
  existingClient: ExistingClientRecord
  updatedValues: {
    name: string
    notes: string | null
    slugToUpdate: string | null
    billingType: ClientBillingTypeValue
  }
  existingMemberIds: string[]
  nextMemberIds: string[]
}

type ClientDiff = {
  changedFields: string[]
  previousDetails: Record<string, unknown>
  nextDetails: Record<string, unknown>
  memberChanges?: {
    added: string[]
    removed: string[]
  }
}

async function recordUpdateActivity(args: RecordUpdateActivityArgs) {
  const diff = calculateDiff(args)

  if (diff.changedFields.length === 0) {
    return
  }

  const { userContext, existingClient } = args
  const detailsPayload =
    Object.keys(diff.previousDetails).length > 0 ||
    Object.keys(diff.nextDetails).length > 0
      ? { before: diff.previousDetails, after: diff.nextDetails }
      : undefined

  const event = clientUpdatedEvent({
    name: args.updatedValues.name,
    changedFields: diff.changedFields,
    memberChanges: diff.memberChanges,
    details: detailsPayload,
  })

  await logActivity({
    actorId: userContext.id,
    actorRole: userContext.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CLIENT',
    targetId: existingClient.id,
    targetClientId: existingClient.id,
    metadata: event.metadata,
  })
}

function calculateDiff({
  existingClient,
  updatedValues,
  existingMemberIds,
  nextMemberIds,
}: Omit<RecordUpdateActivityArgs, 'userContext'>): ClientDiff {
  const changedFields: string[] = []
  const previousDetails: Record<string, unknown> = {}
  const nextDetails: Record<string, unknown> = {}

  if (existingClient.name !== updatedValues.name) {
    changedFields.push('name')
    previousDetails.name = existingClient.name
    nextDetails.name = updatedValues.name
  }

  const previousSlug = existingClient.slug ?? null
  const nextSlug = updatedValues.slugToUpdate ?? null

  if (previousSlug !== nextSlug) {
    changedFields.push('slug')
    previousDetails.slug = previousSlug
    nextDetails.slug = nextSlug
  }

  const previousNotes = existingClient.notes ?? null
  const nextNotes = updatedValues.notes ?? null

  if (previousNotes !== nextNotes) {
    changedFields.push('notes')
    previousDetails.notes = previousNotes
    nextDetails.notes = nextNotes
  }

  const previousBillingType = existingClient.billingType
  const nextBillingType = updatedValues.billingType

  if (previousBillingType !== nextBillingType) {
    changedFields.push('billing type')
    previousDetails.billingType = previousBillingType
    nextDetails.billingType = nextBillingType
  }

  const addedMembers = diff(nextMemberIds, existingMemberIds)
  const removedMembers = diff(existingMemberIds, nextMemberIds)

  if (addedMembers.length > 0 || removedMembers.length > 0) {
    changedFields.push('members')
    return {
      changedFields,
      previousDetails,
      nextDetails,
      memberChanges: {
        added: addedMembers,
        removed: removedMembers,
      },
    }
  }

  return {
    changedFields,
    previousDetails,
    nextDetails,
  }
}

function diff(primary: string[], comparison: string[]): string[] {
  return primary.filter(id => !comparison.includes(id))
}

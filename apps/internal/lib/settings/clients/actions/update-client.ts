import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientUpdatedEvent } from '@/lib/activity/events'
import type { UserRole } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, clients } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { isMonthClosed } from '@/lib/data/reports/close'
import {
  currentMonthStartUtc,
  nextMonthStartUtc,
  upsertBillingTerm,
} from '@/lib/queries/clients/billing-terms'
import {
  commissionAssignmentsEqual,
  upsertCommissionTerm,
} from '@/lib/queries/clients/commission-terms'
import {
  assertClientPartnerUserRoles,
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
  /** Month boundary the report basis switches at when billingType changes. */
  billingEffective: 'current_month' | 'next_month'
  /** Month boundary the Monthly Close switches closer/origination at. */
  commissionEffective: 'current_month' | 'next_month'
  state: string | null
  website: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
  notes: string | null
  memberIds?: string[]
}

class ClosedMonthError extends Error {
  constructor(effectiveFrom: string) {
    const label = new Date(`${effectiveFrom}T00:00:00Z`).toLocaleDateString(
      'en-US',
      { month: 'long', year: 'numeric', timeZone: 'UTC' }
    )
    super(
      `That month's books are closed. Reopen ${label} before changing its billing or commission basis.`
    )
    this.name = 'ClosedMonthError'
  }
}

type ExistingClientRecord = {
  id: string
  name: string
  slug: string | null
  billingType: ClientBillingTypeValue
  notes: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
}

export async function updateClient(
  context: ClientMutationContext,
  payload: UpdateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const {
    id,
    name,
    providedSlug,
    billingType,
    billingEffective,
    commissionEffective,
    state,
    website,
    originationContactId,
    originationUserId,
    closerUserId,
    notes,
    memberIds,
  } = payload

  const partnerRoleError = await assertClientPartnerUserRoles({
    originationUserId,
    closerUserId,
  })
  if (partnerRoleError) {
    return buildMutationResult(partnerRoleError)
  }

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
        originationContactId: clients.originationContactId,
        originationUserId: clients.originationUserId,
        closerUserId: clients.closerUserId,
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

  let existingMemberIds: string[] | undefined = undefined

  if (memberIds) {
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
  }

  const billingTypeChanged = existingClient.billingType !== billingType
  const billingEffectiveFrom = billingTypeChanged
    ? billingEffective === 'current_month'
      ? currentMonthStartUtc()
      : nextMonthStartUtc()
    : null

  // Closer + origination are one logical "commission split" (PRD 007): any
  // change to either writes one effective-dated term so closed months keep
  // resolving to the assignment they were paid under.
  const nextAssignment = { closerUserId, originationUserId, originationContactId }
  const commissionChanged = !commissionAssignmentsEqual(
    existingClient,
    nextAssignment
  )
  const commissionEffectiveFrom = commissionChanged
    ? commissionEffective === 'current_month'
      ? currentMonthStartUtc()
      : nextMonthStartUtc()
    : null

  try {
    await db.transaction(async tx => {
      if (billingTypeChanged && billingEffectiveFrom) {
        // Guard inside the transaction — a check-then-write outside it would
        // let a concurrent close slip between the check and the term upsert.
        if (await isMonthClosed(billingEffectiveFrom)) {
          throw new ClosedMonthError(billingEffectiveFrom)
        }

        await upsertBillingTerm(tx, {
          clientId: id,
          billingType,
          effectiveFrom: billingEffectiveFrom,
          createdBy: user.id,
        })
      }

      if (commissionChanged && commissionEffectiveFrom) {
        if (await isMonthClosed(commissionEffectiveFrom)) {
          throw new ClosedMonthError(commissionEffectiveFrom)
        }

        await upsertCommissionTerm(tx, {
          clientId: id,
          effectiveFrom: commissionEffectiveFrom,
          ...nextAssignment,
          createdBy: user.id,
        })
      }

      // The billingType / closer / origination writes below are the
      // current-value cache flip (what the client list, detail page and sheet
      // show); the terms rows' effective_from controls report resolution.
      await tx
        .update(clients)
        .set({
          name,
          slug: slugToUpdate,
          billingType,
          state,
          website,
          originationContactId,
          originationUserId,
          closerUserId,
          notes,
        })
        .where(eq(clients.id, id))
    })
  } catch (error) {
    if (error instanceof ClosedMonthError) {
      return buildMutationResult({ error: error.message })
    }
    console.error('Failed to update client', error)
    return buildMutationResult({
      error:
        error instanceof Error ? error.message : 'Unable to update client.',
    })
  }

  if (memberIds) {
    const syncResult = await syncClientMembers(id, memberIds)

    if (syncResult.error) {
      return buildMutationResult(syncResult)
    }
  }

  await recordUpdateActivity({
    userContext: { id: user.id, role: user.role },
    existingClient,
    updatedValues: {
      name,
      notes,
      slugToUpdate,
      billingType,
      billingEffectiveFrom,
      commissionEffectiveFrom,
      originationContactId,
      originationUserId,
      closerUserId,
    },
    existingMemberIds: existingMemberIds ?? [],
    nextMemberIds: memberIds ?? [],
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
    billingEffectiveFrom: string | null
    commissionEffectiveFrom: string | null
    originationContactId: string | null
    originationUserId: string | null
    closerUserId: string | null
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
    // Month boundary the report basis switches at (the cache flips at save).
    nextDetails.billingTypeEffectiveFrom = updatedValues.billingEffectiveFrom
  }

  // Origination — treat both sides (user + contact) as a single logical
  // field for the activity feed. Any change to either one surfaces as
  // "origination".
  const previousOriginationUserId = existingClient.originationUserId ?? null
  const nextOriginationUserId = updatedValues.originationUserId ?? null
  const previousOriginationContactId =
    existingClient.originationContactId ?? null
  const nextOriginationContactId = updatedValues.originationContactId ?? null

  if (
    previousOriginationUserId !== nextOriginationUserId ||
    previousOriginationContactId !== nextOriginationContactId
  ) {
    changedFields.push('origination')
    previousDetails.originationUserId = previousOriginationUserId
    previousDetails.originationContactId = previousOriginationContactId
    nextDetails.originationUserId = nextOriginationUserId
    nextDetails.originationContactId = nextOriginationContactId
    nextDetails.commissionEffectiveFrom = updatedValues.commissionEffectiveFrom
  }

  const previousCloserUserId = existingClient.closerUserId ?? null
  const nextCloserUserId = updatedValues.closerUserId ?? null

  if (previousCloserUserId !== nextCloserUserId) {
    changedFields.push('closer')
    previousDetails.closerUserId = previousCloserUserId
    nextDetails.closerUserId = nextCloserUserId
    // Month boundary the Monthly Close switches at (the cache flips at save).
    nextDetails.commissionEffectiveFrom = updatedValues.commissionEffectiveFrom
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

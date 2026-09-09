import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { insertInitialBillingTerm } from '@/lib/queries/clients/billing-terms'
import {
  assertClientPartnerUserRoles,
  generateUniqueClientSlug,
  syncClientMembers,
  toClientSlug,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

type CreateClientPayload = {
  name: string
  providedSlug: string | null
  billingType: ClientBillingTypeValue
  state: string | null
  website: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
  notes: string | null
  memberIds?: string[]
}

const INSERT_RETRY_LIMIT = 3

export async function createClient(
  context: ClientMutationContext,
  payload: CreateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const {
    name,
    providedSlug,
    billingType,
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

  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  let slugCandidate = await generateUniqueClientSlug(baseSlug)
  let attempt = 0

  while (attempt < INSERT_RETRY_LIMIT) {
    try {
      // Client + initial billing term are atomic: a client without a terms
      // row is invisible to every monthly close. A slug unique-violation
      // aborts the transaction and the loop retries with a fresh slug.
      const clientId = await db.transaction(async tx => {
        const inserted = await tx
          .insert(clients)
          .values({
            name,
            slug: slugCandidate,
            billingType,
            state,
            website,
            originationContactId,
            originationUserId,
            closerUserId,
            notes,
            createdBy: user.id,
          })
          .returning({ id: clients.id })

        const insertedId = inserted[0]?.id

        if (!insertedId) {
          return null
        }

        await insertInitialBillingTerm(tx, {
          clientId: insertedId,
          billingType,
          createdBy: user.id,
        })

        return insertedId
      })

      if (!clientId) {
        console.error('Client created without returning identifier')
        return buildMutationResult({ error: 'Unable to create client.' })
      }

      if (memberIds && memberIds.length > 0) {
        const syncResult = await syncClientMembers(clientId, memberIds)

        if (syncResult.error) {
          console.error('Failed to sync client members after create', syncResult)
          return buildMutationResult(syncResult)
        }
      }

      const event = clientCreatedEvent({
        name,
        memberIds: memberIds ?? [],
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CLIENT',
        targetId: clientId,
        targetClientId: clientId,
        metadata: event.metadata,
      })

      return buildMutationResult({ clientId, slug: slugCandidate })
    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error('Failed to create client', error)
        return buildMutationResult({
          error:
            error instanceof Error ? error.message : 'Unable to create client.',
        })
      }

      slugCandidate = await generateUniqueClientSlug(baseSlug)
      attempt += 1
      continue
    }
  }

  return buildMutationResult({
    error: 'Could not generate a unique slug. Please try again.',
  })
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

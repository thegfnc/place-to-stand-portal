import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import {
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
  notes: string | null
  memberIds: string[]
}

const INSERT_RETRY_LIMIT = 3

export async function createClient(
  context: ClientMutationContext,
  payload: CreateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const { name, providedSlug, notes, memberIds } = payload

  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  let slugCandidate = await generateUniqueClientSlug(baseSlug)
  let attempt = 0

  while (attempt < INSERT_RETRY_LIMIT) {
    try {
      const inserted = await db
        .insert(clients)
        .values({
          name,
          slug: slugCandidate,
          notes,
          createdBy: user.id,
        })
        .returning({ id: clients.id })

      const clientId = inserted[0]?.id

      if (!clientId) {
        console.error('Client created without returning identifier')
        return buildMutationResult({ error: 'Unable to create client.' })
      }

      const syncResult = await syncClientMembers(clientId, memberIds)

      if (syncResult.error) {
        console.error('Failed to sync client members after create', syncResult)
        return buildMutationResult(syncResult)
      }

      const event = clientCreatedEvent({
        name,
        memberIds,
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

      return buildMutationResult({})
    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error('Failed to create client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to create client.',
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

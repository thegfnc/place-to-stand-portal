import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
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
  const { supabase, user } = context
  const { name, providedSlug, notes, memberIds } = payload

  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  const initialSlug = await generateUniqueClientSlug(supabase, baseSlug)

  if (typeof initialSlug !== 'string') {
    return buildMutationResult({ error: 'Unable to generate client slug.' })
  }

  let slugCandidate = initialSlug
  let attempt = 0

  while (attempt < INSERT_RETRY_LIMIT) {
    const { data: inserted, error } = await supabase
      .from('clients')
      .insert({
        name,
        slug: slugCandidate,
        notes,
        created_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (!error) {
      if (!inserted?.id) {
        console.error('Client created without returning identifier')
        return buildMutationResult({ error: 'Unable to create client.' })
      }

      const syncResult = await syncClientMembers(
        supabase,
        inserted.id,
        memberIds
      )

      if (syncResult.error) {
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
        targetId: inserted.id,
        targetClientId: inserted.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }

    if (error?.code !== '23505') {
      console.error('Failed to create client', error)
      return buildMutationResult({
        error: error?.message ?? 'Unable to create client.',
      })
    }

    const nextSlug = await generateUniqueClientSlug(supabase, baseSlug)

    if (typeof nextSlug !== 'string') {
      return buildMutationResult({ error: 'Unable to generate client slug.' })
    }

    slugCandidate = nextSlug
    attempt += 1
  }

  return buildMutationResult({
    error: 'Could not generate a unique slug. Please try again.',
  })
}

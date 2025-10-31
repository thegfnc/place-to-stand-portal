import { logActivity } from '@/lib/activity/logger'
import { clientRestoredEvent } from '@/lib/activity/events'
import {
  restoreClientSchema,
  type RestoreClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

export async function restoreClientMutation(
  context: ClientMutationContext,
  input: RestoreClientInput
): Promise<ClientMutationResult> {
  const parsed = restoreClientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid restore request.' })
  }

  const { supabase, user } = context
  const { data: existingClient, error: loadError } = await supabase
    .from('clients')
    .select('id, name, deleted_at')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load client for restore', loadError)
    return buildMutationResult({ error: 'Unable to restore client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  if (!existingClient.deleted_at) {
    return buildMutationResult({ error: 'Client is already active.' })
  }

  const { error: restoreError } = await supabase
    .from('clients')
    .update({ deleted_at: null })
    .eq('id', parsed.data.id)

  if (restoreError) {
    console.error('Failed to restore client', restoreError)
    return buildMutationResult({ error: restoreError.message })
  }

  const event = clientRestoredEvent({ name: existingClient.name })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CLIENT',
    targetId: existingClient.id,
    targetClientId: existingClient.id,
    metadata: event.metadata,
  })

  return buildMutationResult({})
}

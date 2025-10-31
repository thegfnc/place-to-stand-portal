import { logActivity } from '@/lib/activity/logger'
import { clientDeletedEvent } from '@/lib/activity/events'
import {
  destroyClientSchema,
  type DestroyClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

export async function destroyClientMutation(
  context: ClientMutationContext,
  input: DestroyClientInput
): Promise<ClientMutationResult> {
  const parsed = destroyClientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid permanent delete request.' })
  }

  const { supabase, user } = context
  const { data: existingClient, error: loadError } = await supabase
    .from('clients')
    .select('id, name, deleted_at')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load client for permanent delete', loadError)
    return buildMutationResult({
      error: 'Unable to permanently delete client.',
    })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  if (!existingClient.deleted_at) {
    return buildMutationResult({
      error: 'Archive the client before permanently deleting.',
    })
  }

  const [
    { count: projectCount, error: projectError },
    { count: hourBlockCount, error: hourBlockError },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', parsed.data.id),
    supabase
      .from('hour_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', parsed.data.id),
  ])

  if (projectError) {
    console.error('Failed to check client projects before delete', projectError)
    return buildMutationResult({
      error: 'Unable to verify project dependencies.',
    })
  }

  if (hourBlockError) {
    console.error(
      'Failed to check client hour blocks before delete',
      hourBlockError
    )
    return buildMutationResult({
      error: 'Unable to verify hour block dependencies.',
    })
  }

  const blockingResources: string[] = []

  if ((projectCount ?? 0) > 0) {
    blockingResources.push('projects')
  }

  if ((hourBlockCount ?? 0) > 0) {
    blockingResources.push('hour blocks')
  }

  if (blockingResources.length > 0) {
    const resourceSummary =
      blockingResources.length === 1
        ? blockingResources[0]
        : `${blockingResources.slice(0, -1).join(', ')} and ${
            blockingResources[blockingResources.length - 1]
          }`

    return buildMutationResult({
      error: `Cannot permanently delete this client while ${resourceSummary} reference it.`,
    })
  }

  const { error: memberDeleteError } = await supabase
    .from('client_members')
    .delete()
    .eq('client_id', parsed.data.id)

  if (memberDeleteError) {
    console.error(
      'Failed to remove client memberships before delete',
      memberDeleteError
    )
    return buildMutationResult({
      error: 'Unable to remove client memberships.',
    })
  }

  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .eq('id', parsed.data.id)

  if (deleteError) {
    console.error('Failed to permanently delete client', deleteError)
    return buildMutationResult({ error: deleteError.message })
  }

  const event = clientDeletedEvent({ name: existingClient.name })

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

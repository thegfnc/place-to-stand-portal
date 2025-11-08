import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientRestoredEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
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

  const { user } = context
  assertAdmin(user)

  let existingClient:
    | {
        id: string
        name: string
        deletedAt: string | null
      }
    | undefined

  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(eq(clients.id, parsed.data.id))
      .limit(1)

    existingClient = rows[0]
  } catch (error) {
    console.error('Failed to load client for restore', error)
    return buildMutationResult({ error: 'Unable to restore client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  if (!existingClient.deletedAt) {
    return buildMutationResult({ error: 'Client is already active.' })
  }

  try {
    await db
      .update(clients)
      .set({ deletedAt: null })
      .where(eq(clients.id, parsed.data.id))
  } catch (error) {
    console.error('Failed to restore client', error)
    return buildMutationResult({
      error:
        error instanceof Error ? error.message : 'Unable to restore client.',
    })
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

import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientDeletedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clientMembers, clients } from '@/lib/db/schema'
import {
  countHourBlocksForClient,
  countProjectsForClient,
} from '@/lib/queries/clients'
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

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode: 'destroy',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertAdmin(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'Admin privileges required.' })
      }

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
        console.error('Failed to load client for permanent delete', error)
        return buildMutationResult({
          error: 'Unable to permanently delete client.',
        })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      if (!existingClient.deletedAt) {
        return buildMutationResult({
          error: 'Archive the client before permanently deleting.',
        })
      }

      let projectCount = 0
      let hourBlockCount = 0

      try {
        ;[projectCount, hourBlockCount] = await Promise.all([
          countProjectsForClient(parsed.data.id),
          countHourBlocksForClient(parsed.data.id),
        ])
      } catch (error) {
        console.error(
          'Failed to check client dependencies before delete',
          error
        )
        return buildMutationResult({
          error: 'Unable to verify client dependencies.',
        })
      }

      const blockingResources: string[] = []

      if (projectCount > 0) {
        blockingResources.push('projects')
      }

      if (hourBlockCount > 0) {
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

      try {
        await db
          .delete(clientMembers)
          .where(eq(clientMembers.clientId, parsed.data.id))
      } catch (error) {
        console.error(
          'Failed to remove client memberships before delete',
          error
        )
        return buildMutationResult({
          error: 'Unable to remove client memberships.',
        })
      }

      try {
        await db.delete(clients).where(eq(clients.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to permanently delete client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete client.',
        })
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
  )
}

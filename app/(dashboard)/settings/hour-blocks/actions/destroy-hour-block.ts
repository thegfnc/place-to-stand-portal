'use server'

import { revalidatePath } from 'next/cache'

import type { PostgresError } from 'postgres'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockDeletedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { hourBlocks } from '@/lib/db/schema'
import { getHourBlockWithClientById } from '@/lib/queries/hour-blocks'

import { destroySchema } from './schemas'
import type { ActionResult, DestroyInput } from './types'
import { HOUR_BLOCKS_SETTINGS_PATH } from './helpers'

export async function destroyHourBlock(
  input: DestroyInput
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'hour_block',
      mode: 'destroy',
      targetId: input.id,
    },
    async () => {
      const user = await requireUser()
      assertAdmin(user)

      const parsed = destroySchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid permanent delete request.' }
      }

      const hourBlockId = parsed.data.id

      const existingHourBlock = await getHourBlockWithClientById(
        user,
        hourBlockId
      )

      if (!existingHourBlock) {
        return { error: 'Hour block not found.' }
      }

      if (!existingHourBlock.deleted_at) {
        return {
          error: 'Archive the hour block before permanently deleting.',
        }
      }

      try {
        await db.delete(hourBlocks).where(eq(hourBlocks.id, hourBlockId))
      } catch (error) {
        console.error('Failed to permanently delete hour block', error)

        if (isPostgresError(error) && error.code === '23503') {
          return {
            error:
              'Cannot permanently delete this hour block while other records reference it.',
          }
        }

        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete hour block.',
        }
      }

      const event = hourBlockDeletedEvent({
        clientName: existingHourBlock.client?.name ?? null,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetId: existingHourBlock.id,
        targetClientId: existingHourBlock.client_id,
        metadata: event.metadata,
      })

      revalidatePath(HOUR_BLOCKS_SETTINGS_PATH)

      return {}
    }
  )
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  )
}

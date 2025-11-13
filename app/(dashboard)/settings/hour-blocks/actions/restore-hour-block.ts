'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockRestoredEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { hourBlocks } from '@/lib/db/schema'
import { getHourBlockWithClientById } from '@/lib/queries/hour-blocks'

import { restoreSchema } from './schemas'
import type { ActionResult, RestoreInput } from './types'
import { HOUR_BLOCKS_SETTINGS_PATH } from './helpers'

export async function restoreHourBlock(
  input: RestoreInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'hour_block',
      mode: 'restore',
      targetId: input.id,
    },
    async () => performRestoreHourBlock(input),
  )
}

async function performRestoreHourBlock(
  input: RestoreInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = restoreSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const hourBlockId = parsed.data.id

  const existingHourBlock = await getHourBlockWithClientById(user, hourBlockId)

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  if (!existingHourBlock.deleted_at) {
    return { error: 'Hour block is already active.' }
  }

  try {
    await db
      .update(hourBlocks)
      .set({ deletedAt: null, updatedAt: new Date().toISOString() })
      .where(eq(hourBlocks.id, hourBlockId))
  } catch (error) {
    console.error('Failed to restore hour block', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to restore hour block.',
    }
  }

  const event = hourBlockRestoredEvent({
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

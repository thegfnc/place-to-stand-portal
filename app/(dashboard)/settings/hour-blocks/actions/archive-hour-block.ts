'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockArchivedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { hourBlocks } from '@/lib/db/schema'
import { getHourBlockWithClientById } from '@/lib/queries/hour-blocks'

import { deleteSchema } from './schemas'
import type { ActionResult, DeleteInput } from './types'
import { HOUR_BLOCKS_SETTINGS_PATH } from './helpers'

export async function softDeleteHourBlock(
  input: DeleteInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'hour_block',
      mode: 'delete',
      targetId: input.id,
    },
    async () => performSoftDeleteHourBlock(input),
  )
}

async function performSoftDeleteHourBlock(
  input: DeleteInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const hourBlockId = parsed.data.id

  const existingHourBlock = await getHourBlockWithClientById(user, hourBlockId)

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  try {
    await db
      .update(hourBlocks)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hourBlocks.id, hourBlockId))
  } catch (error) {
    console.error('Failed to archive hour block', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to archive hour block.',
    }
  }

  const event = hourBlockArchivedEvent({
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

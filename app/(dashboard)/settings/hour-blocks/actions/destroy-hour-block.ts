'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockDeletedEvent } from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { destroySchema } from './schemas'
import type { ActionResult, DestroyInput } from './types'
import {
  HOUR_BLOCKS_SETTINGS_PATH,
  fetchHourBlockWithClient,
} from './helpers'

export async function destroyHourBlock(
  input: DestroyInput
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = destroySchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid permanent delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const hourBlockId = parsed.data.id

  const { hourBlock: existingHourBlock, error: loadError } =
    await fetchHourBlockWithClient(supabase, hourBlockId)

  if (loadError) {
    console.error('Failed to load hour block for permanent delete', loadError)
    return { error: 'Unable to permanently delete hour block.' }
  }

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  if (!existingHourBlock.deleted_at) {
    return {
      error: 'Archive the hour block before permanently deleting.',
    }
  }

  const { error: deleteError } = await supabase
    .from('hour_blocks')
    .delete()
    .eq('id', hourBlockId)

  if (deleteError) {
    console.error('Failed to permanently delete hour block', deleteError)

    if (deleteError.code === '23503') {
      return {
        error:
          'Cannot permanently delete this hour block while other records reference it.',
      }
    }

    return { error: deleteError.message }
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

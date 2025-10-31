'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockRestoredEvent } from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { restoreSchema } from './schemas'
import type { ActionResult, RestoreInput } from './types'
import { HOUR_BLOCKS_SETTINGS_PATH, fetchHourBlockWithClient } from './helpers'

export async function restoreHourBlock(
  input: RestoreInput
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = restoreSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const supabase = getSupabaseServerClient()
  const hourBlockId = parsed.data.id

  const { hourBlock: existingHourBlock, error: loadError } =
    await fetchHourBlockWithClient(supabase, hourBlockId)

  if (loadError) {
    console.error('Failed to load hour block for restore', loadError)
    return { error: 'Unable to restore hour block.' }
  }

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  if (!existingHourBlock.deleted_at) {
    return { error: 'Hour block is already active.' }
  }

  const { error: restoreError } = await supabase
    .from('hour_blocks')
    .update({ deleted_at: null })
    .eq('id', hourBlockId)

  if (restoreError) {
    console.error('Failed to restore hour block', restoreError)
    return { error: restoreError.message }
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

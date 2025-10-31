'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { hourBlockArchivedEvent } from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { deleteSchema } from './schemas'
import type { ActionResult, DeleteInput } from './types'
import {
  HOUR_BLOCKS_SETTINGS_PATH,
  fetchHourBlockWithClient,
} from './helpers'

export async function softDeleteHourBlock(
  input: DeleteInput
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const hourBlockId = parsed.data.id

  const { hourBlock: existingHourBlock, error: loadError } =
    await fetchHourBlockWithClient(supabase, hourBlockId)

  if (loadError) {
    console.error('Failed to load hour block for archive', loadError)
    return { error: 'Unable to archive hour block.' }
  }

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  const { error } = await supabase
    .from('hour_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', hourBlockId)

  if (error) {
    console.error('Failed to archive hour block', error)
    return { error: error.message }
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

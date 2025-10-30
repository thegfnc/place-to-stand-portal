'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import {
  clientArchivedEvent,
  clientCreatedEvent,
  clientUpdatedEvent,
} from '@/lib/activity/events'
import {
  clientSchema,
  deleteClientSchema,
  generateUniqueClientSlug,
  clientSlugExists,
  syncClientMembers,
  toClientSlug,
  type ClientActionResult,
  type ClientInput,
} from '@/lib/settings/clients/client-service'
import { getSupabaseServerClient } from '@/lib/supabase/server'
const INSERT_RETRY_LIMIT = 3

export async function saveClient(
  input: ClientInput
): Promise<ClientActionResult> {
  const user = await requireUser()
  const parsed = clientSchema.safeParse(input)

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid client payload.',
    }
  }

  const supabase = getSupabaseServerClient()
  const { id, name, slug, notes, memberIds } = parsed.data
  const normalizedMemberIds = Array.from(new Set(memberIds ?? [])).filter(
    Boolean
  )

  const trimmedName = name.trim()

  if (!trimmedName) {
    return { error: 'Name is required.' }
  }

  const cleanedNotes = notes?.trim() ? notes.trim() : null
  const providedSlug = slug?.trim() || null

  if (!id) {
    const baseSlug = providedSlug
      ? toClientSlug(providedSlug)
      : toClientSlug(trimmedName)
    const initialSlug = await generateUniqueClientSlug(supabase, baseSlug)

    if (typeof initialSlug !== 'string') {
      return { error: 'Unable to generate client slug.' }
    }

    let slugCandidate = initialSlug
    let attempt = 0

    while (attempt < INSERT_RETRY_LIMIT) {
      const { data: inserted, error } = await supabase
        .from('clients')
        .insert({
          name: trimmedName,
          slug: slugCandidate,
          notes: cleanedNotes,
          created_by: user.id,
        })
        .select('id')
        .maybeSingle()

      if (!error) {
        if (!inserted?.id) {
          console.error('Client created without returning identifier')
          return { error: 'Unable to create client.' }
        }

        const syncResult = await syncClientMembers(
          supabase,
          inserted.id,
          normalizedMemberIds
        )

        if (syncResult.error) {
          return syncResult
        }

        const event = clientCreatedEvent({
          name: trimmedName,
          memberIds: normalizedMemberIds,
        })

        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'CLIENT',
          targetId: inserted.id,
          targetClientId: inserted.id,
          metadata: event.metadata,
        })

        revalidatePath('/settings/clients')
        return {}
      }

      if (error?.code !== '23505') {
        console.error('Failed to create client', error)
        return { error: error?.message ?? 'Unable to create client.' }
      }

      const nextSlug = await generateUniqueClientSlug(supabase, baseSlug)

      if (typeof nextSlug !== 'string') {
        return { error: 'Unable to generate client slug.' }
      }

      slugCandidate = nextSlug
      attempt += 1
    }

    return {
      error: 'Could not generate a unique slug. Please try again.',
    }
  }

  const slugToUpdate: string | null = providedSlug
    ? toClientSlug(providedSlug)
    : null

  if (slugToUpdate && slugToUpdate.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (slugToUpdate) {
    const exists = await clientSlugExists(supabase, slugToUpdate, {
      excludeId: id,
    })

    if (typeof exists !== 'boolean') {
      return { error: 'Unable to validate slug availability.' }
    }

    if (exists) {
      return { error: 'Another client already uses this slug.' }
    }
  }

  const { data: existingClient, error: existingClientError } = await supabase
    .from('clients')
    .select('id, name, slug, notes')
    .eq('id', id)
    .maybeSingle()

  if (existingClientError) {
    console.error('Failed to load client for update', existingClientError)
    return { error: 'Unable to update client.' }
  }

  if (!existingClient) {
    return { error: 'Client not found.' }
  }

  const { data: existingMemberRows, error: existingMembersError } =
    await supabase
      .from('client_members')
      .select('user_id')
      .eq('client_id', id)
      .is('deleted_at', null)

  if (existingMembersError) {
    console.error('Failed to load client members', existingMembersError)
    return { error: 'Unable to update client members.' }
  }

  const existingMemberIds = (existingMemberRows ?? []).map(
    member => member.user_id
  )

  const { error } = await supabase
    .from('clients')
    .update({ name: trimmedName, slug: slugToUpdate, notes: cleanedNotes })
    .eq('id', id)

  if (error) {
    console.error('Failed to update client', error)
    return { error: error.message }
  }

  const syncResult = await syncClientMembers(supabase, id, normalizedMemberIds)

  if (syncResult.error) {
    return syncResult
  }

  const changedFields: string[] = []
  const previousDetails: Record<string, unknown> = {}
  const nextDetails: Record<string, unknown> = {}

  if (existingClient.name !== trimmedName) {
    changedFields.push('name')
    previousDetails.name = existingClient.name
    nextDetails.name = trimmedName
  }

  const previousSlug = existingClient.slug ?? null
  const nextSlug = slugToUpdate ?? null

  if (previousSlug !== nextSlug) {
    changedFields.push('slug')
    previousDetails.slug = previousSlug
    nextDetails.slug = nextSlug
  }

  const previousNotes = existingClient.notes ?? null
  const nextNotes = cleanedNotes ?? null

  if (previousNotes !== nextNotes) {
    changedFields.push('notes')
    previousDetails.notes = previousNotes
    nextDetails.notes = nextNotes
  }

  const addedMembers = normalizedMemberIds.filter(
    memberId => !existingMemberIds.includes(memberId)
  )
  const removedMembers = existingMemberIds.filter(
    memberId => !normalizedMemberIds.includes(memberId)
  )

  const hasMemberChanges = addedMembers.length > 0 || removedMembers.length > 0

  if (hasMemberChanges) {
    changedFields.push('members')
  }

  if (changedFields.length > 0 || hasMemberChanges) {
    const detailsPayload =
      Object.keys(previousDetails).length > 0 ||
      Object.keys(nextDetails).length > 0
        ? { before: previousDetails, after: nextDetails }
        : undefined

    const event = clientUpdatedEvent({
      name: trimmedName,
      changedFields,
      memberChanges: hasMemberChanges
        ? { added: addedMembers, removed: removedMembers }
        : undefined,
      details: detailsPayload,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CLIENT',
      targetId: id,
      targetClientId: id,
      metadata: event.metadata,
    })
  }

  revalidatePath('/settings/clients')

  return {}
}

export async function softDeleteClient(input: {
  id: string
}): Promise<ClientActionResult> {
  const user = await requireUser()
  const parsed = deleteClientSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const { data: existingClient, error: loadError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load client for archive', loadError)
    return { error: 'Unable to archive client.' }
  }

  if (!existingClient) {
    return { error: 'Client not found.' }
  }

  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('Failed to archive client', error)
    return { error: error.message }
  }

  const event = clientArchivedEvent({ name: existingClient.name })

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

  revalidatePath('/settings/clients')

  return {}
}

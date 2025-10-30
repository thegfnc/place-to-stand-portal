'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import {
  userArchivedEvent,
  userCreatedEvent,
  userRestoredEvent,
  userUpdatedEvent,
} from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import {
  createPortalUser,
  restorePortalUser,
  softDeletePortalUser,
  updatePortalUser,
} from '@/lib/settings/users/services'
import {
  createUserSchema,
  deleteUserSchema,
  restoreUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type DeleteUserInput,
  type RestoreUserInput,
  type UpdateUserInput,
} from '@/lib/settings/users/user-validation'

type ActionResult = {
  error?: string
}

export async function createUser(
  input: CreateUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Please supply a valid email, full name, and role.' }
  }

  const payload = parsed.data
  const result = await createPortalUser(payload)

  if (!result.error) {
    if (result.userId) {
      const event = userCreatedEvent({
        fullName: payload.fullName,
        role: payload.role,
        email: payload.email,
      })

      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'USER',
        targetId: result.userId,
        metadata: event.metadata,
      })
    }

    revalidatePath('/settings/users')
  }

  return result
}

export async function updateUser(
  input: UpdateUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = updateUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid user update payload.' }
  }

  const payload = parsed.data
  const supabase = getSupabaseServerClient()

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, email, full_name, role, avatar_url')
    .eq('id', payload.id)
    .maybeSingle()

  if (existingUserError) {
    console.error('Failed to load user for update', existingUserError)
    return { error: 'Unable to update user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await updatePortalUser(payload)

  if (!result.error) {
    const { data: updatedUser, error: updatedUserError } = await supabase
      .from('users')
      .select('full_name, role, avatar_url')
      .eq('id', payload.id)
      .maybeSingle()

    if (updatedUserError) {
      console.error('Failed to reload user after update', updatedUserError)
    }

    const resolvedFullName =
      updatedUser?.full_name ?? payload.fullName ?? existingUser.full_name
    const resolvedRole = updatedUser?.role ?? payload.role ?? existingUser.role
    const resolvedAvatar =
      updatedUser?.avatar_url ?? existingUser.avatar_url ?? null

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingUser.full_name !== resolvedFullName) {
      changedFields.push('name')
      previousDetails.fullName = existingUser.full_name
      nextDetails.fullName = resolvedFullName
    }

    if (existingUser.role !== resolvedRole) {
      changedFields.push('role')
      previousDetails.role = existingUser.role
      nextDetails.role = resolvedRole
    }

    const previousAvatar = existingUser.avatar_url ?? null
    const nextAvatar = resolvedAvatar

    if (previousAvatar !== nextAvatar) {
      changedFields.push('avatar')
      previousDetails.avatarUrl = previousAvatar
      nextDetails.avatarUrl = nextAvatar
    }

    if (payload.password) {
      changedFields.push('password')
    }

    if (changedFields.length > 0) {
      const detailsPayload =
        Object.keys(previousDetails).length > 0 ||
        Object.keys(nextDetails).length > 0
          ? { before: previousDetails, after: nextDetails }
          : undefined

      const event = userUpdatedEvent({
        fullName: resolvedFullName,
        changedFields,
        details: detailsPayload,
        passwordChanged: Boolean(payload.password),
      })

      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'USER',
        targetId: payload.id,
        metadata: event.metadata,
      })
    }

    revalidatePath('/settings/users')
  }

  return result
}

export async function softDeleteUser(
  input: DeleteUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = deleteUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const payload = parsed.data
  const supabase = getSupabaseServerClient()

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', payload.id)
    .maybeSingle()

  if (existingUserError) {
    console.error('Failed to load user for archive', existingUserError)
    return { error: 'Unable to archive user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await softDeletePortalUser(payload)

  if (!result.error) {
    const event = userArchivedEvent({
      fullName: existingUser.full_name ?? existingUser.email ?? 'User',
      email: existingUser.email ?? undefined,
      role: existingUser.role,
    })

    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'USER',
      targetId: payload.id,
      metadata: event.metadata,
    })

    revalidatePath('/settings/users')
    revalidatePath('/settings/clients')
    revalidatePath('/settings/projects')
  }

  return result
}

export async function restoreUser(
  input: RestoreUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = restoreUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const payload = parsed.data
  const supabase = getSupabaseServerClient()

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', payload.id)
    .maybeSingle()

  if (existingUserError) {
    console.error('Failed to load user for restore', existingUserError)
    return { error: 'Unable to restore user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await restorePortalUser(payload)

  if (!result.error) {
    const { data: restoredUser, error: restoredUserError } = await supabase
      .from('users')
      .select('email, full_name, role')
      .eq('id', payload.id)
      .maybeSingle()

    if (restoredUserError) {
      console.error('Failed to reload user after restore', restoredUserError)
    }

    const resolvedUser = restoredUser ?? existingUser
    const event = userRestoredEvent({
      fullName: resolvedUser.full_name ?? resolvedUser.email ?? 'User',
      email: resolvedUser.email ?? undefined,
      role: resolvedUser.role,
    })

    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'USER',
      targetId: payload.id,
      metadata: event.metadata,
    })

    revalidatePath('/settings/users')
    revalidatePath('/settings/clients')
    revalidatePath('/settings/projects')
  }

  return result
}

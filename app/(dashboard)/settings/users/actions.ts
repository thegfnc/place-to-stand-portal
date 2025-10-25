'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'

import {
  createPortalUser,
  restorePortalUser,
  softDeletePortalUser,
  updatePortalUser,
} from '@/src/lib/settings/users/services'
import {
  createUserSchema,
  deleteUserSchema,
  restoreUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type DeleteUserInput,
  type RestoreUserInput,
  type UpdateUserInput,
} from '@/src/lib/settings/users/user-validation'

type ActionResult = {
  error?: string
}

export async function createUser(
  input: CreateUserInput
): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Please supply a valid email, full name, and role.' }
  }

  const result = await createPortalUser(parsed.data)

  if (!result.error) {
    revalidatePath('/settings/users')
  }

  return result
}

export async function updateUser(
  input: UpdateUserInput
): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = updateUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid user update payload.' }
  }

  const result = await updatePortalUser(parsed.data)

  if (!result.error) {
    revalidatePath('/settings/users')
  }

  return result
}

export async function softDeleteUser(
  input: DeleteUserInput
): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = deleteUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const result = await softDeletePortalUser(parsed.data)

  if (!result.error) {
    revalidatePath('/settings/users')
    revalidatePath('/settings/clients')
    revalidatePath('/settings/projects')
  }

  return result
}

export async function restoreUser(
  input: RestoreUserInput
): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = restoreUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const result = await restorePortalUser(parsed.data)

  if (!result.error) {
    revalidatePath('/settings/users')
  }

  return result
}

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { clientMembers, users } from '@/lib/db/schema'
import {
  clientSlugExistsDrizzle,
  generateUniqueClientSlugDrizzle,
} from '@/lib/queries/clients'

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      'Slugs can only contain lowercase letters, numbers, and dashes'
    )
    .or(z.literal(''))
    .nullish()
    .transform(value => (value ? value : null)),
  notes: z
    .string()
    .nullish()
    .transform(value => (value ? value : null)),
  memberIds: z.array(z.string().uuid()).optional(),
})

const clientIdentifierSchema = {
  id: z.string().uuid(),
}

export const deleteClientSchema = z.object(clientIdentifierSchema)
export const restoreClientSchema = z.object(clientIdentifierSchema)
export const destroyClientSchema = z.object(clientIdentifierSchema)

export type ClientInput = z.infer<typeof clientSchema>
export type DeleteClientInput = z.infer<typeof deleteClientSchema>
export type RestoreClientInput = z.infer<typeof restoreClientSchema>
export type DestroyClientInput = z.infer<typeof destroyClientSchema>

export type ClientActionResult = {
  error?: string
}

export type ClientSlugOptions = {
  excludeId?: string
}

const DEFAULT_SLUG = 'client'
const UNIQUE_RETRY_LIMIT = 3

export function toClientSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || DEFAULT_SLUG
}

export async function clientSlugExists(
  slug: string,
  options: ClientSlugOptions = {}
): Promise<boolean> {
  return clientSlugExistsDrizzle(slug, options)
}

export async function generateUniqueClientSlug(base: string): Promise<string> {
  const normalizedBase = base || DEFAULT_SLUG
  let candidate = normalizedBase
  let suffix = 2
  let attempt = 0

  while (attempt < UNIQUE_RETRY_LIMIT) {
    const exists = await clientSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
    attempt += 1
  }

  return generateUniqueClientSlugDrizzle(normalizedBase, {
    initialCandidate: candidate,
    startSuffix: suffix,
  })
}

export async function syncClientMembers(
  clientId: string,
  memberIds: string[]
): Promise<ClientActionResult> {
  const uniqueMemberIds = Array.from(new Set(memberIds))

  if (uniqueMemberIds.length) {
    try {
      const memberUsers = await db
        .select({
          id: users.id,
          role: users.role,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(inArray(users.id, uniqueMemberIds))

      if (memberUsers.length !== uniqueMemberIds.length) {
        const foundIds = new Set(memberUsers.map(user => user.id))
        const missingIds = uniqueMemberIds.filter(id => !foundIds.has(id))

        return {
          error: `Some selected users no longer exist: ${missingIds.join(', ')}`,
        }
      }

      const invalidUsers = memberUsers.filter(
        user => user.deletedAt !== null || user.role !== 'CLIENT'
      )

      if (invalidUsers.length > 0) {
        return { error: 'Only active client users can be assigned.' }
      }
    } catch (error) {
      console.error('Failed to validate client members', error)
      return { error: 'Unable to validate selected client users.' }
    }
  }

  const archiveTimestamp = new Date().toISOString()

  try {
    await db
      .update(clientMembers)
      .set({ deletedAt: archiveTimestamp })
      .where(
        and(
          eq(clientMembers.clientId, clientId),
          isNull(clientMembers.deletedAt)
        )
      )
  } catch (error) {
    console.error('Failed to archive prior client members', error)
    return { error: 'Unable to update client members.' }
  }

  if (uniqueMemberIds.length === 0) {
    return {}
  }

  try {
    await db
      .insert(clientMembers)
      .values(
        uniqueMemberIds.map(userId => ({
          clientId,
          userId,
          deletedAt: null,
        }))
      )
      .onConflictDoUpdate({
        target: [clientMembers.clientId, clientMembers.userId],
        set: { deletedAt: null },
      })
  } catch (error) {
    console.error('Failed to upsert client members', error)
    return { error: 'Unable to update client members.' }
  }

  return {}
}

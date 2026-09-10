import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { clientMembers, users } from '@/lib/db/schema'
import {
  clientSlugExistsDrizzle,
  generateUniqueClientSlugDrizzle,
} from '@/lib/queries/clients'
import { CLIENT_BILLING_TYPE_VALUES } from '@/lib/settings/clients/billing-types'

export const clientSchema = z
  .object({
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
    billingType: z.enum(CLIENT_BILLING_TYPE_VALUES).default('prepaid'),
    // Month boundary the report basis switches at when billingType changes on
    // an existing client. Ignored on create and when the type is unchanged.
    billingEffective: z
      .enum(['current_month', 'next_month'])
      .default('next_month'),
    // Month boundary the Monthly Close switches closer/origination at when
    // either changes on an existing client. Ignored on create and when the
    // assignment is unchanged.
    commissionEffective: z
      .enum(['current_month', 'next_month'])
      .default('next_month'),
    state: z
      .string()
      .max(2)
      .nullish()
      .transform(value => (value ? value : null)),
    website: z
      .string()
      .url('Please enter a valid URL')
      .or(z.literal(''))
      .nullish()
      .transform(value => (value ? value : null)),
    notes: z
      .string()
      .nullish()
      .transform(value => (value ? value : null)),
    memberIds: z.array(z.string().uuid()).optional(),
    originationContactId: z
      .string()
      .uuid()
      .nullish()
      .transform(value => value ?? null),
    originationUserId: z
      .string()
      .uuid()
      .nullish()
      .transform(value => value ?? null),
    closerUserId: z
      .string()
      .uuid()
      .nullish()
      .transform(value => value ?? null),
  })
  .refine(
    data =>
      !(data.originationUserId !== null && data.originationContactId !== null),
    {
      message:
        'Pick either an internal partner or an external referrer for origination, not both.',
      path: ['originationUserId'],
    }
  )
  .refine(
    data =>
      data.originationUserId !== null || data.originationContactId !== null,
    {
      message:
        'Origination is required. Pick an internal partner or an external referrer.',
      path: ['originationUserId'],
    }
  )
  // Closer is deliberately optional (PRD 007): with no closer the 20% share
  // is not paid out and the Monthly Close reports it under House (estimated).

/**
 * Verifies that any user IDs referenced by origination / closer fields
 * correspond to active ADMIN users. Non-admin assignment could otherwise
 * silently accrue commissions to CLIENT-role users.
 */
export async function assertClientPartnerUserRoles(params: {
  originationUserId: string | null
  closerUserId: string | null
}): Promise<{ error: string } | null> {
  const ids = [params.originationUserId, params.closerUserId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  )

  if (ids.length === 0) {
    return null
  }

  try {
    const rows = await db
      .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
      .from(users)
      .where(inArray(users.id, ids))

    const found = new Map(rows.map(row => [row.id, row]))

    for (const id of ids) {
      const user = found.get(id)
      if (!user) {
        return { error: 'Selected partner user no longer exists.' }
      }
      if (user.deletedAt !== null) {
        return { error: 'Selected partner user is archived.' }
      }
      if (user.role !== 'ADMIN') {
        return {
          error: 'Only PTS admin users can be set as origination or closer.',
        }
      }
    }
  } catch (error) {
    console.error('Failed to validate partner user roles', error)
    return { error: 'Unable to validate partner assignments.' }
  }

  return null
}

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
  clientId?: string // Returned on successful create
  slug?: string // Returned on successful create (create-from-picker needs it)
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

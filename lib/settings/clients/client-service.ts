import { z } from 'zod'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/supabase/types/database'

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

export const deleteClientSchema = z.object({ id: z.string().uuid() })

export type ClientInput = z.infer<typeof clientSchema>
export type DeleteClientInput = z.infer<typeof deleteClientSchema>

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
  supabase: SupabaseClient<Database>,
  slug: string,
  options: ClientSlugOptions = {}
): Promise<boolean | PostgrestError> {
  let query = supabase.from('clients').select('id').eq('slug', slug).limit(1)

  if (options.excludeId) {
    query = query.neq('id', options.excludeId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Failed to check slug availability', error)
    return error
  }

  return Boolean(data)
}

export async function generateUniqueClientSlug(
  supabase: SupabaseClient<Database>,
  base: string
): Promise<string | PostgrestError> {
  const normalizedBase = base || DEFAULT_SLUG
  let candidate = normalizedBase
  let suffix = 2
  let attempt = 0

  while (attempt < UNIQUE_RETRY_LIMIT) {
    const exists = await clientSlugExists(supabase, candidate)

    if (typeof exists !== 'boolean') {
      return exists
    }

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
    attempt += 1
  }

  return `${normalizedBase}-${Date.now()}`
}

export async function syncClientMembers(
  supabase: SupabaseClient<Database>,
  clientId: string,
  memberIds: string[]
): Promise<ClientActionResult> {
  const uniqueMemberIds = Array.from(new Set(memberIds))

  if (uniqueMemberIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, deleted_at')
      .in('id', uniqueMemberIds)

    if (usersError) {
      console.error('Failed to validate client members', usersError)
      return { error: 'Unable to validate selected client users.' }
    }

    const invalidUsers = (users ?? []).filter(
      user => user.deleted_at !== null || user.role !== 'CLIENT'
    )

    if (invalidUsers.length > 0) {
      return { error: 'Only active client users can be assigned.' }
    }
  }

  const archiveTimestamp = new Date().toISOString()

  const { error: archiveError } = await supabase
    .from('client_members')
    .update({ deleted_at: archiveTimestamp })
    .eq('client_id', clientId)
    .is('deleted_at', null)

  if (archiveError) {
    console.error('Failed to archive prior client members', archiveError)
    return { error: 'Unable to update client members.' }
  }

  if (uniqueMemberIds.length === 0) {
    return {}
  }

  const { error: upsertError } = await supabase.from('client_members').upsert(
    uniqueMemberIds.map(userId => ({
      client_id: clientId,
      user_id: userId,
      deleted_at: null,
    })),
    { onConflict: 'client_id,user_id' }
  )

  if (upsertError) {
    console.error('Failed to upsert client members', upsertError)
    return { error: 'Unable to update client members.' }
  }

  return {}
}

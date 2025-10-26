import 'server-only'

import type { User } from '@supabase/supabase-js'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { UserRole } from '@/lib/auth/session'
import type { Database } from '@/supabase/types/database'

const DEFAULT_ROLE: UserRole = 'CLIENT'

const VALID_ROLES: readonly UserRole[] = ['ADMIN', 'CONTRACTOR', 'CLIENT']

function getMetadataRole(user: User): UserRole | null {
  const rawRole = user.user_metadata?.role

  if (typeof rawRole !== 'string') {
    return null
  }

  const role = rawRole.toUpperCase() as UserRole

  return VALID_ROLES.includes(role) ? role : null
}

export async function ensureUserProfile(user: User) {
  const supabase = getSupabaseServiceClient()

  const { data: existing, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to lookup user profile', error)
    throw error
  }

  const metadataRole = getMetadataRole(user)
  const resolvedRole = metadataRole ?? existing?.role ?? DEFAULT_ROLE

  const payload: Database['public']['Tables']['users']['Insert'] = {
    id: user.id,
    email: user.email ?? '',
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    role: resolvedRole,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    deleted_at: null,
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('users').insert(payload)

    if (insertError) {
      console.error('Failed to create user profile', insertError)
      throw insertError
    }

    return
  }

  const shouldUpdate =
    existing.email !== payload.email || existing.role !== payload.role

  if (!shouldUpdate) {
    return
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      email: payload.email,
      full_name: payload.full_name,
      avatar_url: payload.avatar_url,
      role: payload.role,
      deleted_at: null,
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Failed to update user profile', updateError)
    throw updateError
  }
}

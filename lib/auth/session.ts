import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { and, eq, isNull } from 'drizzle-orm'

import type { Database } from '@/lib/supabase/types'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type AppUser = Database['public']['Tables']['users']['Row']
export type UserRole = Database['public']['Enums']['user_role']

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Failed to resolve Supabase session', error)
    return null
  }

  return data.session ?? null
})

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('Failed to resolve Supabase user', error)
    return null
  }

  if (!user?.id) {
    return null
  }

  try {
    const profileRows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
      .limit(1)

    const profile = profileRows[0]

    if (!profile) {
      return null
    }

    const mappedProfile: AppUser = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatarUrl ?? null,
      full_name: profile.fullName ?? null,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
      deleted_at: profile.deletedAt ?? null,
    }

    return mappedProfile
  } catch (profileError) {
    console.error('Failed to load current user from Drizzle', profileError)
    return null
  }
})

export const requireUser = async () => {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return user
}

export const requireRole = async (allowed: UserRole | UserRole[]) => {
  const user = await requireUser()
  const roles = Array.isArray(allowed) ? allowed : [allowed]

  if (!roles.includes(user.role)) {
    redirect('/unauthorized')
  }

  return user
}

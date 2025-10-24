import 'server-only'

import { cache } from 'react'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { DbUser } from '@/lib/types'

export const fetchAdminUsers = cache(async (): Promise<DbUser[]> => {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'ADMIN')
    .is('deleted_at', null)
    .order('full_name', { ascending: true, nullsFirst: true })

  if (error) {
    console.error('Failed to load admin users', error)
    throw error
  }

  return (data ?? []) as DbUser[]
})

import type { PostgrestError } from '@supabase/supabase-js'

import { getSupabaseServerClient } from '@/lib/supabase/server'

import type { SupabaseServerClient } from './types'

export const getSupabase = (): SupabaseServerClient => getSupabaseServerClient()

export const fetchUserById = async <T extends Record<string, unknown>>(
  supabase: SupabaseServerClient,
  id: string,
  columns: string
): Promise<{ data: T | null; error: PostgrestError | null }> => {
  const response = await supabase
    .from('users')
    .select(columns)
    .eq('id', id)
    .maybeSingle<T>()

  return {
    data: (response.data as T | null) ?? null,
    error: response.error,
  }
}

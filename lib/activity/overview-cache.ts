'use server'

import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/supabase/types/database'

const TABLE = 'activity_overview_cache'

export type ActivityOverviewCacheRow =
  Database['public']['Tables']['activity_overview_cache']['Row']

export async function loadActivityOverviewCache({
  userId,
  timeframeDays,
}: {
  userId: string
  timeframeDays: number
}): Promise<ActivityOverviewCacheRow | null> {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('timeframe_days', timeframeDays)
    .maybeSingle()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Failed to load activity overview cache', error)
    }
    return null
  }

  return data ?? null
}

export async function upsertActivityOverviewCache({
  userId,
  timeframeDays,
  summary,
  cachedAt,
  expiresAt,
}: {
  userId: string
  timeframeDays: number
  summary: string
  cachedAt: string
  expiresAt: string
}): Promise<void> {
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      timeframe_days: timeframeDays,
      summary,
      cached_at: cachedAt,
      expires_at: expiresAt,
    },
    {
      onConflict: 'user_id,timeframe_days',
    }
  )

  if (error) {
    console.error('Failed to upsert activity overview cache', error)
    throw error
  }
}

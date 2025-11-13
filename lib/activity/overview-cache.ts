'use server'

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityOverviewCache } from '@/lib/db/schema'

export type ActivityOverviewCacheRow = {
  id: string
  user_id: string
  timeframe_days: number
  summary: string
  cached_at: string
  expires_at: string
  created_at: string
  updated_at: string
}

type CacheSelection = {
  id: string
  userId: string
  timeframeDays: number
  summary: string
  cachedAt: string
  expiresAt: string
  createdAt: string
  updatedAt: string
}

const cacheSelection = {
  id: activityOverviewCache.id,
  userId: activityOverviewCache.userId,
  timeframeDays: activityOverviewCache.timeframeDays,
  summary: activityOverviewCache.summary,
  cachedAt: activityOverviewCache.cachedAt,
  expiresAt: activityOverviewCache.expiresAt,
  createdAt: activityOverviewCache.createdAt,
  updatedAt: activityOverviewCache.updatedAt,
} as const

export async function loadActivityOverviewCache({
  userId,
  timeframeDays,
}: {
  userId: string
  timeframeDays: number
}): Promise<ActivityOverviewCacheRow | null> {
  try {
    const rows = (await db
      .select(cacheSelection)
      .from(activityOverviewCache)
      .where(
        and(
          eq(activityOverviewCache.userId, userId),
          eq(activityOverviewCache.timeframeDays, timeframeDays)
        )
      )
      .limit(1)) as CacheSelection[]

    if (!rows.length) {
      return null
    }

    return toSupabaseRow(rows[0])
  } catch (error) {
    console.error('Failed to load activity overview cache', error)
    return null
  }
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
  try {
    await db
      .insert(activityOverviewCache)
      .values({
        userId,
        timeframeDays,
        summary,
        cachedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          activityOverviewCache.userId,
          activityOverviewCache.timeframeDays,
        ],
        set: {
          summary,
          cachedAt,
          expiresAt,
          updatedAt: cachedAt,
        },
      })
  } catch (error) {
    console.error('Failed to upsert activity overview cache', error)
    throw error
  }
}

function toSupabaseRow(row: CacheSelection): ActivityOverviewCacheRow {
  return {
    id: row.id,
    user_id: row.userId,
    timeframe_days: row.timeframeDays,
    summary: row.summary,
    cached_at: row.cachedAt,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

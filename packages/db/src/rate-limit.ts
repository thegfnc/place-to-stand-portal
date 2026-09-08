import { sql } from 'drizzle-orm'

import type { DbClient } from './client'

export type RateLimitOptions = {
  /** Stable identifier for what is being limited, e.g. `auth-email:<address>`. */
  key: string
  /** Maximum hits allowed inside one window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export type RateLimitResult = {
  allowed: boolean
  /** Hits recorded in the current window, including this one. */
  count: number
  /** Hits left in the window after this one; never negative. */
  remaining: number
}

/**
 * Fixed-window rate limit backed by Postgres, so it works identically on
 * every Vercel instance without a Redis dependency.
 *
 * One atomic upsert: a missing or expired bucket starts a fresh window at 1,
 * otherwise the counter increments. The caller compares the returned count
 * against the limit — the hit is always recorded, which is what keeps a
 * caller from probing for the boundary without spending attempts.
 *
 * Stale rows are swept opportunistically whenever a window starts, which is
 * rare enough not to matter and frequent enough to keep the table small.
 */
export async function consumeRateLimit(
  db: DbClient,
  { key, limit, windowSeconds }: RateLimitOptions
): Promise<RateLimitResult> {
  const window = sql`make_interval(secs => ${windowSeconds})`

  const rows = await db.execute<{ count: number; window_start: string }>(sql`
    INSERT INTO rate_limit_buckets (key, window_start, count, updated_at)
    VALUES (${key}, timezone('utc', now()), 1, timezone('utc', now()))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.window_start < timezone('utc', now()) - ${window} THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_buckets.window_start < timezone('utc', now()) - ${window}
          THEN timezone('utc', now())
        ELSE rate_limit_buckets.window_start
      END,
      updated_at = timezone('utc', now())
    RETURNING count, window_start
  `)

  const count = Number(rows[0]?.count ?? 1)

  if (count === 1) {
    // Fresh window for this key: cheap moment to drop buckets nobody has
    // touched in a day. Best effort; a failure here must not block the caller.
    db.execute(
      sql`DELETE FROM rate_limit_buckets WHERE window_start < timezone('utc', now()) - interval '1 day'`
    ).catch(() => {})
  }

  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
  }
}

/**
 * First hop of `x-forwarded-for`, which on Vercel is the client address.
 * Falls back to a fixed bucket so a missing header still gets throttled
 * rather than skipping the limit.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || headers.get('x-real-ip') || 'unknown'
}

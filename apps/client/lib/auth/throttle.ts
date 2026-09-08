import 'server-only'

import { headers } from 'next/headers'

import { clientIpFromHeaders, consumeRateLimit } from '@pts/db/rate-limit'

import { db } from '@/lib/db'

const WINDOW_SECONDS = 15 * 60
const PER_ADDRESS_LIMIT = 3
const PER_IP_LIMIT = 10

/**
 * Throttles magic-link and password-reset dispatch.
 *
 * These actions use the admin `generateLink` API, which bypasses Supabase's
 * own per-hour email limit, so without this nothing server-side stops a
 * caller from mailing a known address on a loop. Two counters: one on the
 * normalised address (stops bombing one inbox) and one on the caller's IP
 * (stops spraying many addresses from one place).
 *
 * Returns `false` when either bucket is exhausted. Callers must still answer
 * with the same generic success they give for an unknown address — a
 * distinguishable "slow down" would leak which addresses exist.
 */
export async function allowAuthEmail(email: string): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers())

  const [byAddress, byIp] = await Promise.all([
    consumeRateLimit(db, {
      key: `auth-email:${email}`,
      limit: PER_ADDRESS_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    }),
    consumeRateLimit(db, {
      key: `auth-email-ip:${ip}`,
      limit: PER_IP_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    }),
  ])

  if (!byAddress.allowed || !byIp.allowed) {
    console.warn('Auth email throttled', {
      email,
      ip,
      addressHits: byAddress.count,
      ipHits: byIp.count,
    })
    return false
  }

  return true
}

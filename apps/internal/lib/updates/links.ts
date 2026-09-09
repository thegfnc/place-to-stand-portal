import 'server-only'

import { serverEnv } from '@/lib/env.server'

/**
 * The one link in the email. Items are anchored to tasks for our records,
 * but every task lives behind the same sign-in, so a single button beats a
 * link per item.
 */
export function portalHomeHref(): string {
  return serverEnv.CLIENT_PORTAL_URL.replace(/\/$/, '')
}

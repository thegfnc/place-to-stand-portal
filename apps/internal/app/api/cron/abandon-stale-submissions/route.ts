import { NextResponse, type NextRequest } from 'next/server'

import { submissionsAbandonedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { abandonStaleFormSubmissions } from '@/lib/queries/form-submissions'

/**
 * Daily Vercel Cron (see vercel.json): flips audits stuck at `in_progress`
 * to `abandoned` once their last beacon is older than the cutoff.
 *
 * The marketing site's abandoned beacon rides `pagehide` and is inherently
 * lossy (killed tabs, mobile backgrounding, network loss), so without this
 * sweep stale in_progress rows accumulate forever. Ordering safety against
 * late beacons lives in `abandonStaleFormSubmissions`.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
const STALE_AFTER_HOURS = 24

export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  try {
    const abandonedCount = await abandonStaleFormSubmissions(STALE_AFTER_HOURS)

    if (abandonedCount > 0) {
      console.log(
        `Abandoned ${abandonedCount} stale in-progress submission(s)`
      )

      const event = submissionsAbandonedEvent({
        count: abandonedCount,
        staleAfterHours: STALE_AFTER_HOURS,
      })
      await logActivity({
        actorId: null,
        source: 'SYSTEM',
        verb: event.verb,
        summary: event.summary,
        targetType: 'SUBMISSION',
        metadata: event.metadata,
      })
    }

    return NextResponse.json({ ok: true, data: { abandonedCount } })
  } catch (error) {
    console.error('Failed to abandon stale submissions', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to abandon stale submissions.' },
      { status: 500 }
    )
  }
}

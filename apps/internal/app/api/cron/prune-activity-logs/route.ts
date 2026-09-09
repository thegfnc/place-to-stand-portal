import { NextResponse, type NextRequest } from 'next/server'

import {
  pruneActivityLogsBefore,
  retentionCutoff,
} from '@/lib/activity/retention'
import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'

/**
 * Weekly Vercel Cron (see vercel.json): hard-deletes activity_logs rows older
 * than ACTIVITY_LOG_RETENTION_DAYS. The table is append-only and grows with
 * every mutation, so without a prune it grows forever.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  const cutoff = retentionCutoff(serverEnv.ACTIVITY_LOG_RETENTION_DAYS)

  try {
    const deletedCount = await pruneActivityLogsBefore(cutoff)

    if (deletedCount > 0) {
      console.log(
        `Pruned ${deletedCount} activity log row(s) older than ${cutoff.toISOString()}`
      )
    }

    return NextResponse.json({
      ok: true,
      data: { deletedCount, cutoff: cutoff.toISOString() },
    })
  } catch (error) {
    console.error('Failed to prune activity logs', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to prune activity logs.' },
      { status: 500 }
    )
  }
}

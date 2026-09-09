import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  auditPayloadSchema,
  toAuditSubmissionRow,
} from '@/lib/form-submissions/audit-payload'
import { submissionReceivedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

/**
 * Opportunity Audit progress intake from the marketing site.
 *
 * Called repeatedly for a single audit session as the visitor progresses, and
 * once more from a `pagehide` beacon. Ordering and idempotency are handled in
 * `upsertFormSubmission`; see docs/integrations/marketing-form-submissions.md.
 *
 * Deliberately does NOT call `revalidatePath`: these beacons fire constantly,
 * and /submissions renders dynamically anyway (cookie-based auth + searchParams).
 */
export async function POST(request: NextRequest) {
  const authFailure = verifyIntakeToken(
    request,
    serverEnv.AUDIT_INTAKE_TOKEN,
    'Audit'
  )

  if (authFailure) {
    return authFailure
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for audit intake', error)
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = auditPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    )
  }

  try {
    const result = await upsertFormSubmission(
      toAuditSubmissionRow(parsed.data, request.headers.get('user-agent'))
    )

    // Only the first insert is an event; later beacons for the same session
    // are updates and would otherwise flood the feed.
    if (result?.inserted) {
      const event = submissionReceivedEvent({
        formType: result.kind,
        status: result.status,
      })
      await logActivity({
        actorId: null,
        source: 'SYSTEM',
        verb: event.verb,
        summary: event.summary,
        targetType: 'SUBMISSION',
        targetId: result.id,
        metadata: event.metadata,
      })
    }
  } catch (error) {
    console.error('Failed to record audit submission', error)
    return NextResponse.json(
      { error: 'Unable to record submission.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

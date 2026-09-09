import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  contactPayloadSchema,
  toContactSubmissionRow,
} from '@/lib/form-submissions/contact-payload'
import { submissionReceivedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

/**
 * Contact form intake from the marketing site.
 *
 * One-shot: the submission arrives complete and is never updated. It shares
 * the upsert path with the audit intake purely for idempotency — a retry with
 * the same `submissionId` is a no-op rather than a duplicate row.
 *
 * See docs/integrations/marketing-form-submissions.md.
 */
export async function POST(request: NextRequest) {
  const authFailure = verifyIntakeToken(
    request,
    serverEnv.CONTACT_INTAKE_TOKEN,
    'Contact'
  )

  if (authFailure) {
    return authFailure
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for contact intake', error)
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = contactPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    )
  }

  try {
    const result = await upsertFormSubmission(
      toContactSubmissionRow(parsed.data, request.headers.get('user-agent'))
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
    console.error('Failed to record contact submission', error)
    return NextResponse.json(
      { error: 'Unable to record submission.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

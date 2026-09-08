import { z } from 'zod'

import type { NewFormSubmission } from '@pts/db/types'

import {
  analyticsSchema,
  attributionSchema,
  clientSchema,
  isoDateTime,
} from './envelope'
import { resolveTopServiceId } from './types'

/**
 * Validation for `POST /api/integrations/audit-responses`.
 *
 * Strictness is deliberately mixed: values backed by a Postgres enum are
 * `z.enum` (a bad value must fail loudly), while marketing-owned taxonomy —
 * phase ids, service ids, question ids — is plain `z.string()`. Those are
 * stored as `text`/`jsonb`, so accepting an unrecognized value costs nothing,
 * whereas rejecting one would 400 and silently lose the beacon the first time
 * the marketing site ships a new phase.
 *
 * See docs/integrations/marketing-form-submissions.md for the full contract.
 */

const shortText = z.string().trim().max(255)
const longText = z.string().trim().max(5000)

const responseItemSchema = z.object({
  questionId: z.string().trim().max(128),
  sectionId: z.string().trim().max(128),
  prompt: z.string().trim().max(1024),
  type: z.enum(['single', 'multi', 'text']),
  value: z.union([
    z.string().max(5000),
    z.array(z.string().max(500)).max(64),
    z.null(),
  ]),
  labels: z.array(z.string().max(5000)).max(64),
})

const recommendationSchema = z.object({
  serviceId: z.string().trim().max(120),
  serviceName: z.string().trim().max(255),
  score: z.number(),
  reasons: z.array(z.string().max(1000)).max(20),
})

const resultSchema = z.object({
  phaseId: z.string().trim().max(120),
  phaseName: z.string().trim().max(255),
  summary: longText,
  generatedBy: z.enum(['rules', 'ai']),
  phaseScores: z.record(z.string(), z.number()),
  recommendations: z.array(recommendationSchema).max(50),
})

export const auditPayloadSchema = z.object({
  sessionId: z.uuid(),
  status: z.enum(['in_progress', 'completed', 'captured', 'abandoned']),
  trigger: z.enum([
    'started',
    'step_completed',
    'scored',
    'captured',
    'abandoned',
    'pagehide',
  ]),
  sourceDetail: shortText.min(1),

  startedAt: isoDateTime,
  updatedAt: isoDateTime,
  completedAt: isoDateTime.nullable(),

  progress: z.object({
    furthestStepIndex: z.number().int().min(0),
    stepsTotal: z.number().int().min(0),
    answeredCount: z.number().int().min(0),
    questionsTotal: z.number().int().min(0),
    percentComplete: z.number().int().min(0).max(100),
    durationMs: z.number().int().min(0),
  }),

  responses: z.array(responseItemSchema).max(200),

  result: resultSchema.nullable(),

  lead: z
    .object({
      name: shortText,
      email: z.email().max(320),
      company: shortText.nullable(),
      // Optional "anything else we should know" note from the capture form.
      // Optional so a marketing deploy that predates the field still lands.
      message: z.string().trim().max(10000).nullable().optional(),
      marketingConsent: z.boolean(),
    })
    .nullable(),

  analytics: analyticsSchema,
  attribution: attributionSchema,
  client: clientSchema,
})

export type AuditPayload = z.infer<typeof auditPayloadSchema>

export function toAuditSubmissionRow(
  payload: AuditPayload,
  requestUserAgent: string | null
): NewFormSubmission {
  const { progress, result, lead, analytics, attribution, client } = payload

  return {
    kind: 'audit',
    sessionKey: payload.sessionId,
    status: payload.status,
    lastTrigger: payload.trigger,
    sourceDetail: payload.sourceDetail,

    startedAt: payload.startedAt,
    lastActivityAt: payload.updatedAt,
    completedAt: payload.completedAt,
    // Not in the payload — derived so the FIRST capture is what sticks.
    capturedAt: payload.status === 'captured' ? payload.updatedAt : null,
    durationMs: progress.durationMs,

    furthestStepIndex: progress.furthestStepIndex,
    stepsTotal: progress.stepsTotal,
    answeredCount: progress.answeredCount,
    questionsTotal: progress.questionsTotal,
    percentComplete: progress.percentComplete,

    responses: payload.responses,
    result,
    phaseId: result?.phaseId ?? null,
    topServiceId: resolveTopServiceId(result?.recommendations),

    contactName: lead?.name ?? null,
    contactEmail: lead?.email ?? null,
    contactCompany: lead?.company ?? null,
    contactWebsite: null,
    subject: null,
    message: lead?.message ?? null,
    marketingConsent: lead?.marketingConsent ?? null,

    posthogDistinctId: analytics.posthogDistinctId,
    posthogSessionId: analytics.posthogSessionId,
    posthogReplayUrl: analytics.posthogReplayUrl,

    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmTerm: attribution.utmTerm,
    utmContent: attribution.utmContent,
    gclid: attribution.gclid,
    referrer: attribution.referrer,
    landingPath: attribution.landingPath,

    viewport: client.viewport,
    screenWidth: client.screenWidth,
    timezone: client.timezone,
    language: client.language,
    // The payload value wins. Beacons reach us via the marketing site's own
    // proxy route (sendBeacon cannot set an Authorization header), so OUR
    // request header is that proxy's Node fetch agent, not the visitor's
    // browser. Their route already sets `client.userAgent` server-side from
    // the real browser request, so it is both trustworthy and the only place
    // the visitor's UA survives. The request header is a fallback for a
    // hypothetical direct caller.
    userAgent: client.userAgent ?? requestUserAgent,
  }
}

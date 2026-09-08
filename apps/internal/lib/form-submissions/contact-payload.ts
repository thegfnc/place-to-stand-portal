import { z } from 'zod'

import type { NewFormSubmission } from '@pts/db/types'

import {
  analyticsSchema,
  attributionSchema,
  clientSchema,
  isoDateTime,
} from './envelope'

/**
 * Validation for `POST /api/integrations/contact-submissions`.
 *
 * The contact form is one-shot: it arrives already "captured" (we have a name
 * and email) and is never updated. It shares the analytics/attribution/client
 * blocks with the audit payload so both forms land in the same table with the
 * same attribution data.
 *
 * See docs/integrations/marketing-form-submissions.md for the full contract.
 */

const shortText = z.string().trim().max(256)

export const contactPayloadSchema = z.object({
  submissionId: z.uuid(),
  sourceDetail: shortText.min(1),
  submittedAt: isoDateTime,

  contact: z.object({
    name: shortText.min(1),
    email: z.email().max(320),
    company: shortText.nullable(),
    website: z.string().trim().max(2048).nullable(),
    // Optional so a marketing deploy that predates the field still lands.
    subject: shortText.nullable().optional(),
    message: z.string().trim().max(10000),
    marketingConsent: z.boolean(),
  }),

  analytics: analyticsSchema,
  attribution: attributionSchema,
  client: clientSchema,
})

export type ContactPayload = z.infer<typeof contactPayloadSchema>

export function toContactSubmissionRow(
  payload: ContactPayload,
  requestUserAgent: string | null
): NewFormSubmission {
  const { contact, analytics, attribution, client } = payload

  return {
    kind: 'contact',
    sessionKey: payload.submissionId,
    // A contact submission always arrives complete — there is no partial state.
    status: 'captured',
    lastTrigger: null,
    sourceDetail: payload.sourceDetail,

    startedAt: payload.submittedAt,
    lastActivityAt: payload.submittedAt,
    completedAt: payload.submittedAt,
    capturedAt: payload.submittedAt,
    durationMs: null,

    // Audit-only progress and payload columns stay null for contact rows.
    furthestStepIndex: null,
    stepsTotal: null,
    answeredCount: null,
    questionsTotal: null,
    percentComplete: null,
    responses: null,
    result: null,
    phaseId: null,
    topServiceId: null,

    contactName: contact.name,
    contactEmail: contact.email,
    contactCompany: contact.company,
    contactWebsite: contact.website,
    subject: contact.subject ?? null,
    message: contact.message,
    marketingConsent: contact.marketingConsent,

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
    // The payload value wins — see the note in audit-payload.ts. The contact
    // form posts from the marketing site's server action, so our request
    // header is its Node fetch agent, not the visitor's browser.
    userAgent: client.userAgent ?? requestUserAgent,
  }
}

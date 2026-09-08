/**
 * Dev utility: exercise the marketing form intake endpoints end to end.
 *
 * The audit intake exists because `sendBeacon` on `pagehide` has no delivery
 * ordering guarantee — a stale `abandoned` beacon routinely lands after
 * `captured`. That race is the whole reason for the GREATEST/COALESCE/setWhere
 * upsert, and it is very hard to notice by hand. This script reproduces it.
 *
 * Requires a running server whose environment has both intake tokens set:
 *
 *   AUDIT_INTAKE_TOKEN=... CONTACT_INTAKE_TOKEN=... npm run dev
 *
 * then, from apps/internal:
 *
 *   AUDIT_INTAKE_TOKEN=... CONTACT_INTAKE_TOKEN=... \
 *     BASE_URL=http://localhost:3000 npx tsx scripts/test-form-intake.ts
 *
 * Writes real rows to whatever DATABASE_URL points at, then deletes them — do
 * not aim it at production.
 *
 * This script is NOT executed automatically.
 */

import { randomUUID } from 'crypto'

import { config } from 'dotenv'
import { eq } from 'drizzle-orm'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const AUDIT_TOKEN = process.env.AUDIT_INTAKE_TOKEN
const CONTACT_TOKEN = process.env.CONTACT_INTAKE_TOKEN

const sessionId = randomUUID()
const submissionId = randomUUID()
const throwawaySessionId = randomUUID()

let failures = 0

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.error(`  ✗ ${label}`, detail === undefined ? '' : detail)
  }
}

function at(offsetSeconds: number) {
  return new Date(Date.UTC(2026, 6, 30, 18, 0, offsetSeconds)).toISOString()
}

async function post(path: string, token: string | undefined, body: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  return { status: response.status, body: await response.json().catch(() => null) }
}

function submitAudit(payload: unknown) {
  return post('/api/integrations/audit-responses', AUDIT_TOKEN, payload)
}

function submitContact(payload: unknown) {
  return post('/api/integrations/contact-submissions', CONTACT_TOKEN, payload)
}

const QUESTIONS = [
  { questionId: 'industry', sectionId: 'business', prompt: 'What industry are you in?' },
  { questionId: 'revenue', sectionId: 'business', prompt: 'Annual revenue?' },
  { questionId: 'bottlenecks', sectionId: 'challenges', prompt: 'Where do things bog down?' },
  { questionId: 'budget', sectionId: 'readiness', prompt: "What's your budget?" },
]

function responses(answeredCount: number) {
  return QUESTIONS.map((question, index) => ({
    ...question,
    type: 'single' as const,
    value: index < answeredCount ? 'tech-saas' : null,
    labels: index < answeredCount ? ['Tech / SaaS'] : [],
  }))
}

const RESULT = {
  phaseId: 'growth',
  phaseName: 'Growth',
  summary: 'You are ready to scale operations.',
  generatedBy: 'rules' as const,
  phaseScores: { foundation: 2, launch: 4, growth: 9 },
  recommendations: [
    { serviceId: 'internal-tools', serviceName: 'Internal Tools', score: 6, reasons: ['Manual ops'] },
    { serviceId: 'workflow-automation', serviceName: 'Workflow Automation', score: 9, reasons: ['Repetitive handoffs'] },
  ],
}

const ENVELOPE = {
  sourceDetail: 'https://placetostandagency.com/audit',
  analytics: {
    posthogDistinctId: 'distinct-123',
    posthogSessionId: 'session-123',
    posthogReplayUrl: 'https://us.posthog.com/project/1/replay/session-123',
  },
  attribution: {
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'ai-audit-q3',
    utmTerm: null,
    utmContent: null,
    gclid: 'Cj0KCQtest',
    referrer: 'https://www.google.com/',
    landingPath: '/audit',
  },
  client: {
    viewport: 'desktop' as const,
    screenWidth: 1440,
    timezone: 'America/Denver',
    language: 'en-US',
    userAgent: 'Mozilla/5.0 (test-form-intake)',
  },
}

function auditBeacon(overrides: Record<string, unknown>) {
  return {
    sessionId,
    status: 'in_progress',
    trigger: 'step_completed',
    startedAt: at(0),
    updatedAt: at(10),
    completedAt: null,
    progress: {
      furthestStepIndex: 1,
      stepsTotal: 4,
      answeredCount: 2,
      questionsTotal: 4,
      percentComplete: 50,
      durationMs: 10_000,
    },
    responses: responses(2),
    result: null,
    lead: null,
    ...ENVELOPE,
    ...overrides,
  }
}

async function main() {
  if (!AUDIT_TOKEN || !CONTACT_TOKEN) {
    console.error(
      'AUDIT_INTAKE_TOKEN and CONTACT_INTAKE_TOKEN must both be set here AND in\n' +
        'the environment of the server at BASE_URL.'
    )
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to verify the written rows.')
    process.exit(1)
  }

  // Connect directly rather than via `@/lib/db` — that module is marked
  // `server-only`, which does not resolve outside the Next runtime.
  const { createDb } = await import('@pts/db/client')
  const { formSubmissions } = await import('@pts/db/schema')
  const db = createDb(process.env.DATABASE_URL)

  const readRow = async (key: string) => {
    const [row] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.sessionKey, key))
    return row ?? null
  }

  console.log(`\nTarget: ${BASE_URL}`)
  console.log(`Audit session: ${sessionId}\n`)

  console.log('Auth')
  const unauthed = await post('/api/integrations/audit-responses', undefined, {})
  if (unauthed.status === 500) {
    console.error(
      '\n  Server returned 500 for an unauthenticated request, which means it\n' +
        '  has no AUDIT_INTAKE_TOKEN set. Restart it with both tokens in its\n' +
        '  environment (or add them to .env.local) and re-run.\n'
    )
    process.exit(1)
  }
  check('no token -> 401', unauthed.status === 401, unauthed.status)
  check(
    'wrong token -> 401',
    (await post('/api/integrations/audit-responses', 'nope', {})).status === 401
  )

  console.log('\nValidation')
  check(
    'bad payload -> 400',
    (await submitAudit({ sessionId: 'not-a-uuid' })).status === 400
  )
  check(
    'unknown phase id accepted (marketing taxonomy is not enum-locked)',
    (
      await submitAudit(
        auditBeacon({
          // Separate session — writing to `sessionId` here would seed a newer
          // last_activity_at and make the progression below get gated out.
          sessionId: throwawaySessionId,
          status: 'completed',
          trigger: 'scored',
          updatedAt: at(5),
          completedAt: at(5),
          result: { ...RESULT, phaseId: 'a-brand-new-phase' },
        })
      )
    ).status === 200
  )
  check(
    'bad status enum -> 400',
    (await submitAudit(auditBeacon({ status: 'not_a_status' }))).status === 400
  )

  // --- Audit happy path ---------------------------------------------------
  console.log('\nAudit progression')
  for (const beacon of [
    auditBeacon({ trigger: 'started', updatedAt: at(1), progress: { furthestStepIndex: 0, stepsTotal: 4, answeredCount: 0, questionsTotal: 4, percentComplete: 0, durationMs: 1000 }, responses: responses(0) }),
    auditBeacon({ trigger: 'step_completed', updatedAt: at(10) }),
    auditBeacon({
      status: 'completed',
      trigger: 'scored',
      updatedAt: at(20),
      completedAt: at(20),
      progress: { furthestStepIndex: 3, stepsTotal: 4, answeredCount: 4, questionsTotal: 4, percentComplete: 100, durationMs: 20_000 },
      responses: responses(4),
      result: RESULT,
    }),
    auditBeacon({
      status: 'captured',
      trigger: 'captured',
      updatedAt: at(30),
      completedAt: at(20),
      progress: { furthestStepIndex: 3, stepsTotal: 4, answeredCount: 4, questionsTotal: 4, percentComplete: 100, durationMs: 30_000 },
      responses: responses(4),
      result: RESULT,
      lead: { name: 'Dana Reed', email: `dana+${sessionId.slice(0, 8)}@example.com`, company: 'Acme Co.', message: 'We run everything on spreadsheets.', marketingConsent: true },
    }),
  ]) {
    const { status } = await submitAudit(beacon)
    check(`${beacon.trigger} -> 200`, status === 200, status)
  }

  const captured = await readRow(sessionId)
  check('single row for the session', captured !== null)
  check('status is captured', captured?.status === 'captured', captured?.status)
  check('result stored', captured?.result !== null)
  check('top service denormalized to highest score', captured?.topServiceId === 'workflow-automation', captured?.topServiceId)
  check('phase denormalized', captured?.phaseId === 'growth', captured?.phaseId)
  check('contact captured', captured?.contactName === 'Dana Reed', captured?.contactName)
  check('lead message stored', captured?.message === 'We run everything on spreadsheets.', captured?.message)
  check('captured_at set', captured?.capturedAt !== null)
  // Real beacons arrive via the marketing site's proxy route, so OUR request
  // header is that proxy's Node fetch agent. The visitor's browser UA only
  // survives in the payload, which their route sets server-side. This script
  // posts directly, so its own request header is whatever tsx's fetch sends —
  // asserting the payload value wins is exactly the production behaviour.
  check(
    'user agent taken from the payload, not our request header',
    captured?.userAgent === ENVELOPE.client.userAgent,
    captured?.userAgent
  )

  const capturedAtFirstCapture = captured?.capturedAt

  // --- The race this design exists for ------------------------------------
  console.log('\nStale pagehide beacon (older updatedAt, lower status, nulls)')
  const stale = await submitAudit(auditBeacon({
    status: 'abandoned',
    trigger: 'pagehide',
    updatedAt: at(15), // older than the capture at :30
    responses: responses(2),
    result: null,
    lead: null,
  }))
  check('stale beacon still returns 200', stale.status === 200, stale.status)

  const afterStale = await readRow(sessionId)
  check('status still captured', afterStale?.status === 'captured', afterStale?.status)
  check('result not nulled', afterStale?.result !== null)
  check('contact not nulled', afterStale?.contactName === 'Dana Reed', afterStale?.contactName)
  check('last_activity_at did not go backwards', afterStale?.lastActivityAt === captured?.lastActivityAt, afterStale?.lastActivityAt)
  check('transcript not truncated', Array.isArray(afterStale?.responses) && (afterStale?.responses as unknown[]).length === 4)

  console.log('\nNewer pagehide beacon (newer updatedAt, lower status)')
  const newer = await submitAudit(auditBeacon({
    status: 'abandoned',
    trigger: 'pagehide',
    updatedAt: at(45), // newer than the capture
    progress: { furthestStepIndex: 3, stepsTotal: 4, answeredCount: 4, questionsTotal: 4, percentComplete: 100, durationMs: 45_000 },
    responses: responses(4),
    result: null,
    lead: null,
  }))
  check('newer beacon returns 200', newer.status === 200, newer.status)

  const afterNewer = await readRow(sessionId)
  check('status STILL captured (GREATEST, not setWhere)', afterNewer?.status === 'captured', afterNewer?.status)
  check('result still preserved', afterNewer?.result !== null)
  check('last_activity_at advanced', afterNewer?.lastActivityAt !== afterStale?.lastActivityAt)
  check('duration advanced to 45s', afterNewer?.durationMs === 45_000, afterNewer?.durationMs)
  check('captured_at unchanged (first capture wins)', afterNewer?.capturedAt === capturedAtFirstCapture, afterNewer?.capturedAt)

  // --- Contact ------------------------------------------------------------
  console.log('\nContact submission')
  const contact = await submitContact({
    submissionId,
    sourceDetail: 'https://placetostandagency.com/',
    submittedAt: at(0),
    contact: {
      name: 'Sam Lee',
      email: `sam+${submissionId.slice(0, 8)}@example.com`,
      company: null,
      website: null,
      subject: 'Referral Program',
      message: 'Interested in a workflow audit.',
      marketingConsent: false,
    },
    analytics: ENVELOPE.analytics,
    attribution: ENVELOPE.attribution,
    client: ENVELOPE.client,
  })
  check('contact -> 200', contact.status === 200, contact.status)

  const contactRow = await readRow(submissionId)
  check('kind is contact', contactRow?.kind === 'contact', contactRow?.kind)
  check('status is captured', contactRow?.status === 'captured', contactRow?.status)
  check('subject stored', contactRow?.subject === 'Referral Program', contactRow?.subject)
  check('message stored', contactRow?.message === 'Interested in a workflow audit.')
  check('attribution stored', contactRow?.utmCampaign === 'ai-audit-q3', contactRow?.utmCampaign)
  check('audit columns null', contactRow?.responses === null && contactRow?.percentComplete === null)

  console.log('\nContact retry (same submissionId)')
  const retry = await submitContact({
    submissionId,
    sourceDetail: 'https://placetostandagency.com/',
    submittedAt: at(0),
    contact: { name: 'Sam Lee', email: `sam+${submissionId.slice(0, 8)}@example.com`, company: null, website: null, message: 'Interested in a workflow audit.', marketingConsent: false },
    analytics: ENVELOPE.analytics,
    attribution: ENVELOPE.attribution,
    client: ENVELOPE.client,
  })
  check('retry -> 200 (idempotent, no duplicate)', retry.status === 200, retry.status)

  // --- Cleanup ------------------------------------------------------------
  for (const key of [sessionId, submissionId, throwawaySessionId]) {
    await db.delete(formSubmissions).where(eq(formSubmissions.sessionKey, key))
  }
  console.log('\nTest rows deleted.')

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED\n`)
    process.exit(1)
  }
  console.log('\nAll checks passed.\n')
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

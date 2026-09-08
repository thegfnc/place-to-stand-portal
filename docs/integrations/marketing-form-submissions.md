# Marketing form submissions → Portal

Integration contract for the Place To Stand marketing site. Covers the Opportunity Audit
(including partial/abandoned attempts) and the contact form.

Both endpoints write to the portal's `form_submissions` table and surface at
**Sales → Submissions** in the internal portal.

---

## 1. What changes

Today both marketing actions POST to `/api/integrations/leads-intake`, which creates a row in
the portal's `leads` table. That happens **only** on final submit, so:

- everyone who abandons the audit mid-wizard is invisible
- the scored audit result is flattened into a free-text `message` field and can't be queried
- no UTM attribution or PostHog linkage is captured for either form

Going forward, **every** audit attempt is pushed as it progresses, and both forms land in
Submissions first. Leads are promoted from Submissions by hand in the portal.

**The `leads-intake` POST is removed from both marketing actions.** See [§7 Cutover](#7-cutover).

---

## 2. Endpoints

Base URL is the internal portal host — the same host the current `PORTAL_LEADS_ENDPOINT`
points at.

| Purpose | Method + path | Auth header |
| --- | --- | --- |
| Opportunity Audit progress | `POST /api/integrations/audit-responses` | `Authorization: Bearer <AUDIT_INTAKE_TOKEN>` |
| Contact form | `POST /api/integrations/contact-submissions` | `Authorization: Bearer <CONTACT_INTAKE_TOKEN>` |

`Content-Type: application/json` on both.

Two separate tokens so either can be rotated independently. They are issued out of band —
never commit them. Store as `AUDIT_INTAKE_TOKEN` / `CONTACT_INTAKE_TOKEN` in the marketing
site's Vercel project (all environments).

### Responses

| Status | Body | Meaning |
| --- | --- | --- |
| `200` | `{"ok":true}` | Accepted. Also returned when a stale beacon is intentionally discarded — see [§5](#5-idempotency-and-ordering). |
| `400` | `{"error":"..."}` | Malformed JSON, or payload failed validation. `error` is the first validation message. |
| `401` | `{"error":"Unauthorized"}` | Missing, malformed, or mismatched bearer token. |
| `500` | `{"error":"..."}` | Token not configured portal-side, or a database failure. Safe to retry. |

---

## 3. ⚠️ The token must never reach the browser

`navigator.sendBeacon()` **cannot set request headers**. There is no way to attach
`Authorization` to a beacon. And shipping the token to the client so `fetch` can send it
would publish a portal secret in the JS bundle.

**The marketing site must proxy through its own server route:**

```
browser  ──sendBeacon──▶  marketing /api/audit-beacon  ──fetch + Bearer──▶  portal
         (same origin,             (server-side; holds the
          no auth needed)           token, never exposed)
```

Notes:

- The browser → marketing hop is same-origin, so `sendBeacon` works unauthenticated. Use it
  in a `pagehide` handler — it survives tab close where a plain `fetch` does not.
- If you prefer `fetch` for the same-origin hop, use `keepalive: true` so it survives unload.
- The marketing → portal hop is an ordinary server-side `fetch`, so the token stays on the
  server.
- Set `client.userAgent` from the incoming request header in that route handler rather than
  from `navigator.userAgent`. **This is the only place the visitor's browser UA survives** —
  by the time the request reaches the portal, the `User-Agent` header belongs to your server's
  fetch client, so the portal takes `client.userAgent` from the payload and only falls back to
  its own header if that is null.
- The contact form is already a server action — it just changes its POST target and payload.

---

## 4. Payloads

### 4.1 Audit — `POST /api/integrations/audit-responses`

```ts
type AuditStatus = 'in_progress' | 'completed' | 'captured' | 'abandoned'

type AuditTrigger =
  | 'started'        // visitor clicked Start
  | 'step_completed' // finished one of the wizard sections
  | 'scored'         // results generated
  | 'captured'       // email-capture form submitted successfully
  | 'abandoned'      // explicitly backed out of the wizard
  | 'pagehide'       // sendBeacon fired as the tab closed

interface AuditResponseItem {
  questionId: string   // 'industry' | 'revenue' | 'ops-management' | ...
  sectionId: string    // 'business' | 'operations' | 'challenges' | 'readiness'
  prompt: string       // the question text as shown
  type: 'single' | 'multi' | 'text'
  value: string | string[] | null   // raw option id(s), free text, or null if unanswered
  labels: string[]                  // human-readable option labels, [] if unanswered
}

interface AuditProgressPayload {
  sessionId: string    // UUID v4 — idempotency key, stable for the whole session
  status: AuditStatus
  trigger: AuditTrigger
  sourceDetail: string // 'https://placetostandagency.com/audit'

  startedAt: string            // ISO 8601
  updatedAt: string            // ISO 8601 — ordering key, see §5
  completedAt: string | null

  progress: {
    furthestStepIndex: number  // 0-based, max step reached
    stepsTotal: number
    answeredCount: number
    questionsTotal: number
    percentComplete: number    // integer 0-100
    durationMs: number
  }

  // ALWAYS the full question set — unanswered entries included with value: null.
  responses: AuditResponseItem[]

  // null until the audit is scored
  result: {
    phaseId: string            // 'foundation' | 'launch' | 'growth' | ...
    phaseName: string
    summary: string
    generatedBy: 'rules' | 'ai'
    phaseScores: Record<string, number>
    recommendations: Array<{
      serviceId: string        // 'workflow-automation' | 'internal-tools' | ...
      serviceName: string
      score: number
      reasons: string[]
    }>
  } | null

  // null until the email-capture form is submitted (status: 'captured')
  lead: {
    name: string
    email: string
    company: string | null
    // Optional free-text note from the capture form; stored in `message`.
    message?: string | null
    marketingConsent: boolean
  } | null

  analytics: {
    posthogDistinctId: string | null
    posthogSessionId: string | null
    posthogReplayUrl: string | null   // deep link to the session recording
  }

  attribution: {
    utmSource: string | null
    utmMedium: string | null
    utmCampaign: string | null
    utmTerm: string | null
    utmContent: string | null
    gclid: string | null
    referrer: string | null
    landingPath: string | null        // e.g. '/audit'
  }

  client: {
    viewport: 'mobile' | 'tablet' | 'desktop' | null
    screenWidth: number | null
    timezone: string | null           // IANA, e.g. 'America/Denver'
    language: string | null           // e.g. 'en-US'
    userAgent: string | null          // set server-side from the request header
  }
}
```

<details>
<summary>Example — mid-wizard beacon</summary>

```json
{
  "sessionId": "9f1c1c2e-6f4a-4a5f-9b1e-3c2d8f0a77b1",
  "status": "in_progress",
  "trigger": "step_completed",
  "sourceDetail": "https://placetostandagency.com/audit",
  "startedAt": "2026-07-30T18:04:11.221Z",
  "updatedAt": "2026-07-30T18:05:35.902Z",
  "completedAt": null,
  "progress": {
    "furthestStepIndex": 1, "stepsTotal": 4, "answeredCount": 4,
    "questionsTotal": 8, "percentComplete": 50, "durationMs": 84681
  },
  "responses": [
    { "questionId": "industry", "sectionId": "business",
      "prompt": "What industry are you in?", "type": "single",
      "value": "tech-saas", "labels": ["Tech / SaaS"] },
    { "questionId": "bottlenecks", "sectionId": "challenges",
      "prompt": "Where do things bog down?", "type": "multi",
      "value": null, "labels": [] }
  ],
  "result": null,
  "lead": null,
  "analytics": {
    "posthogDistinctId": "0198c3f2-...", "posthogSessionId": "0198c3f2-...",
    "posthogReplayUrl": "https://us.posthog.com/project/123/replay/0198c3f2-..."
  },
  "attribution": {
    "utmSource": "google", "utmMedium": "cpc", "utmCampaign": "ai-audit-q3",
    "utmTerm": null, "utmContent": null, "gclid": "Cj0KCQ...",
    "referrer": "https://www.google.com/", "landingPath": "/audit"
  },
  "client": {
    "viewport": "desktop", "screenWidth": 1440,
    "timezone": "America/Denver", "language": "en-US",
    "userAgent": "Mozilla/5.0 ..."
  }
}
```
</details>

### 4.2 Contact — `POST /api/integrations/contact-submissions`

```ts
interface ContactSubmissionPayload {
  submissionId: string  // UUID v4 — idempotency key
  sourceDetail: string  // 'https://placetostandagency.com/'
  submittedAt: string   // ISO 8601

  contact: {
    name: string
    email: string
    company: string | null
    website: string | null
    // A preset ("Referral Program") or the visitor's own free-form subject.
    subject?: string | null
    message: string
    marketingConsent: boolean
  }

  // identical shapes to the audit payload
  analytics:   { posthogDistinctId, posthogSessionId, posthogReplayUrl }
  attribution: { utmSource, utmMedium, utmCampaign, utmTerm, utmContent,
                 gclid, referrer, landingPath }
  client:      { viewport, screenWidth, timezone, language, userAgent }
}
```

### 4.3 Validation strictness

Deliberately mixed, so that a taxonomy change on the marketing side can never cause silent
data loss:

| Strict — a bad value returns `400` | Lenient — any non-empty string accepted |
| --- | --- |
| `status`, `trigger` | `result.phaseId` |
| `responses[].type` | `result.recommendations[].serviceId` |
| `client.viewport` | `responses[].questionId`, `responses[].sectionId` |
| `sessionId` / `submissionId` must be a valid UUID | |
| all timestamps must be ISO 8601 | |

Adding a sixth phase or a new service on the marketing side needs **no** portal change.

Unknown top-level keys are ignored rather than rejected.

---

## 5. Idempotency and ordering

Audit beacons race. `sendBeacon` on `pagehide` has no delivery-ordering guarantee, so a stale
`abandoned` beacon can and does arrive *after* `captured`. The portal resolves this
atomically on write. Four rules apply:

1. **Upsert on `sessionId`.** All beacons for one session update a single row.
2. **Stale beacons are discarded.** If `updatedAt` is older than what's stored, the write is
   a no-op. The response is still `200` — this is expected behaviour, not an error.
3. **Status only advances**, along `in_progress → abandoned → completed → captured`. It never
   moves backwards.
4. **A non-null `result` or `lead` is never overwritten with null.**

Rules 3 and 4 mean a late `abandoned`/`pagehide` beacon cannot clobber a completed capture.
**The sender does not need to guard against any of this** — send beacons as they happen.

### Sender obligations

Three things the portal cannot do for you:

1. **`sessionId` must be stable for the entire audit session.** Generate it once when the
   wizard starts and persist it (e.g. `sessionStorage`). A fresh UUID per beacon creates a new
   row per beacon instead of updating one.
2. **`updatedAt` must increase monotonically.** Stamp it at *send* time, not render time. It
   is the ordering key; a beacon that goes backwards is silently dropped by rule 2.
3. **`responses` must always be the complete question set**, with unanswered entries present
   and `value: null`. The array is stored wholesale, so sending only answered questions would
   erase previously-captured answers.

### When to send

| Trigger | When |
| --- | --- |
| `started` | visitor begins the wizard |
| `step_completed` | each section is finished |
| `scored` | results generated (`status: 'completed'`, `result` populated) |
| `captured` | email-capture succeeds (`status: 'captured'`, `lead` populated) |
| `abandoned` | visitor explicitly exits the wizard |
| `pagehide` | `pagehide` / `visibilitychange → hidden`, via `sendBeacon` |

Retries are safe at any point — the upsert is idempotent.

---

## 6. Failure handling

A failed POST must never break the visitor's experience. Keep the current
`send-audit.ts` behaviour: log and continue, still show success. The audit's Resend emails and
the Resend audience opt-in are unaffected by this integration and stay as they are.

Because delivery is best-effort, prefer sending **more** beacons rather than fewer — the
upsert makes duplicates free, and a dropped intermediate beacon is recovered by the next one.

---

## 7. Cutover

Order matters. The portal must be live first, or in-flight form submissions are dropped.

1. **Portal deploys** the two endpoints. Nothing calls them yet; `leads-intake` still works.
2. **Marketing site switches over:**
   - point the audit at `/api/integrations/audit-responses` (via the server-side proxy route)
   - point the contact form at `/api/integrations/contact-submissions`
   - **remove** the `leads-intake` POST from `app/actions/send-audit.ts` (~lines 222-257) and
     from `app/actions/send-contact.ts`
   - remove the `PORTAL_LEADS_ENDPOINT` and `PORTAL_LEADS_TOKEN` env vars
   - add `AUDIT_INTAKE_TOKEN` and `CONTACT_INTAKE_TOKEN`
   - keep the Resend emails and audience opt-in exactly as they are
3. **Portal follow-up** removes the now-dead `leads-intake` route and `LEADS_INTAKE_TOKEN`.

After step 2 the marketing site no longer creates portal leads directly. Submissions are
promoted to leads manually in the portal.

---

## 8. Verifying the connection

```bash
curl -i -X POST https://<portal-host>/api/integrations/contact-submissions \
  -H "Authorization: Bearer $CONTACT_INTAKE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "submissionId": "11111111-2222-4333-8444-555555555555",
    "sourceDetail": "https://placetostandagency.com/",
    "submittedAt": "2026-07-30T18:00:00.000Z",
    "contact": {
      "name": "Test Person", "email": "test@example.com",
      "company": null, "website": null, "subject": "Other",
      "message": "Connection test.", "marketingConsent": false
    },
    "analytics": { "posthogDistinctId": null, "posthogSessionId": null, "posthogReplayUrl": null },
    "attribution": { "utmSource": null, "utmMedium": null, "utmCampaign": null, "utmTerm": null,
                     "utmContent": null, "gclid": null, "referrer": null, "landingPath": null },
    "client": { "viewport": null, "screenWidth": null, "timezone": null,
                "language": null, "userAgent": null }
  }'
```

Expect `200 {"ok":true}`, then confirm the row at **Sales → Submissions** in the portal.
Re-running the same command is a no-op (same `submissionId`), which is the idempotency check.

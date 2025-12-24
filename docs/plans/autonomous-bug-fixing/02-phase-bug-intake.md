# Phase 2: Bug Intake & Normalization

**Status:** Planning
**Priority:** High
**Estimated Effort:** 1-2 weeks
**Dependencies:** Existing email integration, Phase 1 (for linking)

---

## Overview

Clients report bugs through various channels - email, chat widgets, web forms, Slack, API calls, or a client portal. This phase creates a unified intake layer that normalizes bug reports from any source into a standardized format that the autonomous fixing system can process.

---

## Goals

1. **Unified intake** - Single internal format regardless of source
2. **Smart extraction** - AI parses unstructured bug reports into structured data
3. **Auto-linking** - Automatically associate bugs with correct project/repo
4. **Rich context** - Capture screenshots, error messages, environment details
5. **Deduplication** - Detect and link related/duplicate bug reports

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              INTAKE SOURCES                                      │
├───────────┬───────────┬───────────┬───────────┬───────────┬───────────────────┤
│   Email   │   Chat    │   Form    │   Slack   │    API    │  Client Portal    │
│  (Gmail)  │  (Widget) │   (Web)   │  (Webhook)│  (Direct) │   (Self-serve)    │
└─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴─────────┬─────────┘
      │           │           │           │           │               │
      ▼           ▼           ▼           ▼           ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SOURCE ADAPTERS                                         │
│  Each adapter extracts raw content and metadata specific to its source          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED INTAKE ENDPOINT                                     │
│                    POST /api/bug-reports/intake                                  │
│  Accepts: { source, rawContent, metadata, attachments, senderInfo }             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      BUG PARSING AGENT (Claude)                                  │
│  Extracts structured data from raw content:                                      │
│  - Title / summary                                                               │
│  - Steps to reproduce                                                            │
│  - Expected vs actual behavior                                                   │
│  - Error messages / stack traces                                                 │
│  - Environment details                                                           │
│  - Severity assessment                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      PROJECT LINKING ENGINE                                      │
│  - Match sender email to client                                                  │
│  - Match client to project(s)                                                    │
│  - Match project to GitHub repo                                                  │
│  - Confidence scoring for ambiguous matches                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      DEDUPLICATION CHECK                                         │
│  - Fuzzy match against recent bug reports                                        │
│  - Link related reports together                                                 │
│  - Prevent duplicate fix jobs                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      BUG REPORT CREATED                                          │
│                    Status: RECEIVED → Ready for fix job                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `bug_reports`

```typescript
// lib/db/schema.ts

export const bugReportSourceEnum = pgEnum('bug_report_source', [
  'EMAIL',       // From Gmail integration
  'CHAT',        // From embedded chat widget
  'FORM',        // From web form submission
  'SLACK',       // From Slack webhook
  'API',         // Direct API call
  'PORTAL',      // Client self-service portal
  'MANUAL',      // Manually created by team
])

export const bugSeverityEnum = pgEnum('bug_severity', [
  'CRITICAL',    // System down, data loss, security issue
  'HIGH',        // Major feature broken, no workaround
  'MEDIUM',      // Feature impaired, workaround exists
  'LOW',         // Minor issue, cosmetic, edge case
])

export const bugReportStatusEnum = pgEnum('bug_report_status', [
  'RECEIVED',          // Just received, not yet processed
  'PARSING',           // AI is extracting structured data
  'PARSED',            // Structured data extracted
  'LINKING',           // Finding project/repo association
  'READY',             // Ready for autonomous fix
  'FIX_QUEUED',        // Fix job queued
  'FIX_IN_PROGRESS',   // Fix job running
  'FIX_COMPLETED',     // Fix created, PR pending
  'PR_CREATED',        // PR created, awaiting review
  'PR_MERGED',         // PR merged, bug fixed
  'CLOSED',            // Closed (fixed or won't fix)
  'NEEDS_INFO',        // Waiting for more information from client
  'NEEDS_HUMAN',       // Requires human intervention
  'FAILED',            // Autonomous fix failed
  'DUPLICATE',         // Marked as duplicate of another report
])

export const bugReports = pgTable('bug_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Source tracking
  source: bugReportSourceEnum('source').notNull(),
  sourceId: text('source_id'), // External ID (email ID, chat session ID, form submission ID)
  sourceUrl: text('source_url'), // Link back to original (email thread, chat transcript)

  // Linking
  clientId: uuid('client_id').references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  githubRepoLinkId: uuid('github_repo_link_id').references(() => githubRepoLinks.id),
  taskId: uuid('task_id').references(() => tasks.id), // If linked to existing task

  // Duplicate tracking
  duplicateOfId: uuid('duplicate_of_id').references((): AnyPgColumn => bugReports.id),
  relatedReportIds: uuid('related_report_ids').array(),

  // Reporter information
  reporterEmail: text('reporter_email'),
  reporterName: text('reporter_name'),
  reporterUserId: uuid('reporter_user_id').references(() => users.id), // If known user

  // Raw input (preserved for debugging/reprocessing)
  rawSubject: text('raw_subject'),
  rawBody: text('raw_body'),
  rawMetadata: jsonb('raw_metadata'),

  // Structured bug details (AI-extracted)
  title: text('title').notNull(),
  description: text('description'),
  stepsToReproduce: text('steps_to_reproduce'),
  expectedBehavior: text('expected_behavior'),
  actualBehavior: text('actual_behavior'),
  errorMessage: text('error_message'),
  stackTrace: text('stack_trace'),
  affectedUrl: text('affected_url'),
  affectedFeature: text('affected_feature'),

  // Environment details
  environment: jsonb('environment').$type<BugEnvironment>(),

  // Attachments
  screenshotUrls: text('screenshot_urls').array(),
  attachmentUrls: text('attachment_urls').array(),

  // Classification
  severity: bugSeverityEnum('severity'),
  severityReason: text('severity_reason'), // AI explanation
  category: text('category'), // UI, API, Database, Performance, Security, etc.
  tags: text('tags').array(),

  // Confidence scores
  parsingConfidence: real('parsing_confidence'), // How confident AI was in extraction
  linkingConfidence: real('linking_confidence'), // How confident in project match

  // Status
  status: bugReportStatusEnum('status').default('RECEIVED').notNull(),
  statusReason: text('status_reason'), // Why in current status

  // Fix tracking
  currentFixJobId: uuid('current_fix_job_id'), // Will reference autonomous_fix_jobs
  fixAttemptCount: integer('fix_attempt_count').default(0),

  // Resolution
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  resolvedBy: text('resolved_by'), // 'AUTONOMOUS', 'HUMAN', or user ID
  resolutionNote: text('resolution_note'),
  prUrl: text('pr_url'),

  // Client communication
  lastClientUpdateAt: timestamp('last_client_update_at', { withTimezone: true, mode: 'string' }),
  clientNotified: boolean('client_notified').default(false),

  // Standard timestamps
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, (table) => [
  index('idx_bug_reports_status')
    .on(table.status)
    .where(sql`deleted_at IS NULL`),
  index('idx_bug_reports_client')
    .on(table.clientId)
    .where(sql`deleted_at IS NULL`),
  index('idx_bug_reports_project')
    .on(table.projectId)
    .where(sql`deleted_at IS NULL`),
  index('idx_bug_reports_source')
    .on(table.source, table.sourceId),
  index('idx_bug_reports_reporter_email')
    .on(table.reporterEmail)
    .where(sql`deleted_at IS NULL`),
  index('idx_bug_reports_created')
    .on(table.createdAt.desc()),
])
```

### Type: `BugEnvironment`

```typescript
// lib/types/bug-reports.ts

export interface BugEnvironment {
  // Browser/client
  browser?: {
    name: string // Chrome, Firefox, Safari, Edge
    version: string
  }

  // Operating system
  os?: {
    name: string // Windows, macOS, Linux, iOS, Android
    version: string
  }

  // Device
  device?: {
    type: 'desktop' | 'tablet' | 'mobile'
    model?: string
  }

  // Application
  app?: {
    version: string
    build?: string
    environment: 'production' | 'staging' | 'development'
  }

  // Network
  network?: {
    type?: string
    connectionSpeed?: string
  }

  // User context
  user?: {
    role?: string
    accountType?: string
    tenantId?: string
  }

  // Custom fields (app-specific)
  custom?: Record<string, string | number | boolean>
}
```

### Table: `bug_report_messages`

Track follow-up messages in a thread.

```typescript
export const bugReportMessages = pgTable('bug_report_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  bugReportId: uuid('bug_report_id')
    .references(() => bugReports.id, { onDelete: 'cascade' })
    .notNull(),

  // Message details
  direction: text('direction').notNull(), // 'inbound' (from client) or 'outbound' (to client)
  source: text('source').notNull(), // EMAIL, CHAT, etc.
  sourceId: text('source_id'),

  // Content
  senderEmail: text('sender_email'),
  senderName: text('sender_name'),
  content: text('content').notNull(),
  contentHtml: text('content_html'),

  // Attachments
  attachmentUrls: text('attachment_urls').array(),

  // AI analysis (for inbound messages)
  providesNewInfo: boolean('provides_new_info'),
  newInfoSummary: text('new_info_summary'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
}, (table) => [
  index('idx_bug_report_messages_report')
    .on(table.bugReportId),
])
```

---

## Source Adapters

### Email Adapter (Gmail)

Extends existing email integration.

```typescript
// lib/bug-intake/adapters/email.ts

export interface EmailBugIntake {
  source: 'EMAIL'
  sourceId: string // Gmail message ID
  sourceUrl: string // Link to email in Gmail

  rawSubject: string
  rawBody: string
  rawBodyHtml: string

  senderEmail: string
  senderName: string

  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    url: string // Stored in Supabase Storage
  }>

  metadata: {
    threadId: string
    receivedAt: string
    labels: string[]
    inReplyTo?: string // If reply to previous thread
  }
}

export async function processEmailAsBug(
  emailMetadata: EmailMetadata,
  emailBody: string
): Promise<EmailBugIntake> {
  // Transform email data to bug intake format
}
```

### Chat Widget Adapter

For embedded chat on client websites.

```typescript
// lib/bug-intake/adapters/chat.ts

export interface ChatBugIntake {
  source: 'CHAT'
  sourceId: string // Chat session ID
  sourceUrl: string // Link to chat transcript

  rawBody: string // Concatenated chat messages

  senderEmail: string
  senderName: string

  attachments: Array<{
    filename: string
    mimeType: string
    url: string
  }>

  metadata: {
    sessionId: string
    pageUrl: string // Where chat was initiated
    sessionDuration: number
    messageCount: number
    userAgent: string
    referrer?: string
  }
}
```

### Web Form Adapter

For dedicated bug report forms.

```typescript
// lib/bug-intake/adapters/form.ts

export interface FormBugIntake {
  source: 'FORM'
  sourceId: string // Form submission ID

  // Pre-structured (forms have fields)
  rawSubject: string
  rawBody: string
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  severity?: string

  senderEmail: string
  senderName: string

  attachments: Array<{
    filename: string
    mimeType: string
    url: string
  }>

  metadata: {
    formId: string
    formVersion: string
    submittedAt: string
    pageUrl: string
    environment?: Partial<BugEnvironment>
  }
}
```

### Slack Adapter

For Slack-based bug reporting.

```typescript
// lib/bug-intake/adapters/slack.ts

export interface SlackBugIntake {
  source: 'SLACK'
  sourceId: string // Slack message ts
  sourceUrl: string // Permalink to message

  rawBody: string

  senderEmail?: string
  senderName: string // Slack display name
  slackUserId: string

  attachments: Array<{
    filename: string
    mimeType: string
    url: string
  }>

  metadata: {
    channelId: string
    channelName: string
    threadTs?: string
    workspaceId: string
    reactions?: string[] // Emoji reactions
  }
}
```

### API Adapter

For direct programmatic submission.

```typescript
// lib/bug-intake/adapters/api.ts

export interface ApiBugIntake {
  source: 'API'
  sourceId: string // Idempotency key

  // Can be pre-structured
  title?: string
  rawBody: string
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  errorMessage?: string
  stackTrace?: string
  severity?: BugSeverity

  senderEmail: string
  senderName?: string

  attachments?: Array<{
    filename: string
    mimeType: string
    url: string
    base64?: string // Or inline base64
  }>

  metadata: {
    apiVersion: string
    clientId?: string // Pre-identified client
    projectId?: string // Pre-identified project
    environment?: BugEnvironment
    customFields?: Record<string, unknown>
  }
}
```

---

## Bug Parsing Agent

### Prompt

```typescript
// lib/bug-intake/parsing-agent.ts

const BUG_PARSING_PROMPT = `You are analyzing a bug report to extract structured information.

The report came from: {{source}}

Raw content:
---
Subject: {{rawSubject}}

Body:
{{rawBody}}
---

Extract the following information. If something is not mentioned, use null.

1. **title**: A clear, concise title for this bug (max 100 chars)
2. **description**: A detailed description of the issue
3. **stepsToReproduce**: Numbered steps to reproduce the bug
4. **expectedBehavior**: What should happen
5. **actualBehavior**: What actually happens
6. **errorMessage**: Any error messages mentioned
7. **stackTrace**: Any stack traces or technical errors
8. **affectedUrl**: The URL where the bug occurs (if mentioned)
9. **affectedFeature**: The feature or area affected
10. **severity**: Assess severity based on impact:
    - CRITICAL: System down, data loss, security vulnerability
    - HIGH: Major feature broken, blocking users
    - MEDIUM: Feature impaired but usable, workaround exists
    - LOW: Minor issue, cosmetic, rare edge case
11. **severityReason**: Brief explanation of severity assessment
12. **category**: One of: UI, API, Database, Performance, Security, Integration, Configuration, Other
13. **environment**: Any mentioned browser, OS, device, app version

Respond with a JSON object matching the BugParsingResult schema.

Be thorough - missing information could prevent the bug from being fixed correctly.
If the report is unclear or seems incomplete, set needsMoreInfo to true and explain what's missing.`

export interface BugParsingResult {
  title: string
  description: string | null
  stepsToReproduce: string | null
  expectedBehavior: string | null
  actualBehavior: string | null
  errorMessage: string | null
  stackTrace: string | null
  affectedUrl: string | null
  affectedFeature: string | null
  severity: BugSeverity
  severityReason: string
  category: string
  environment: Partial<BugEnvironment> | null
  tags: string[]
  confidence: number // 0-1, how confident in the extraction
  needsMoreInfo: boolean
  missingInfoDetails: string | null
}
```

---

## Project Linking Engine

### Matching Logic

```typescript
// lib/bug-intake/linking.ts

export interface LinkingResult {
  clientId: string | null
  projectId: string | null
  githubRepoLinkId: string | null
  confidence: number // 0-1
  matchMethod: 'email_exact' | 'email_domain' | 'explicit' | 'inferred' | 'ambiguous'
  alternativeMatches: Array<{
    clientId: string
    projectId: string
    confidence: number
    reason: string
  }>
}

export async function linkBugToProject(
  senderEmail: string,
  bugContent: BugParsingResult,
  metadata: Record<string, unknown>
): Promise<LinkingResult> {

  // 1. Check for explicit project/client in metadata (API submissions)
  if (metadata.projectId) {
    return await explicitMatch(metadata.projectId as string)
  }

  // 2. Exact email match to client contact
  const exactMatch = await matchByExactEmail(senderEmail)
  if (exactMatch) {
    return {
      ...exactMatch,
      confidence: 1.0,
      matchMethod: 'email_exact'
    }
  }

  // 3. Domain match to client
  const domain = extractDomain(senderEmail)
  const domainMatch = await matchByDomain(domain)
  if (domainMatch) {
    return {
      ...domainMatch,
      confidence: 0.8,
      matchMethod: 'email_domain'
    }
  }

  // 4. Content-based inference (AI)
  const inferredMatch = await inferProjectFromContent(bugContent)
  if (inferredMatch && inferredMatch.confidence > 0.7) {
    return {
      ...inferredMatch,
      matchMethod: 'inferred'
    }
  }

  // 5. No confident match
  return {
    clientId: null,
    projectId: null,
    githubRepoLinkId: null,
    confidence: 0,
    matchMethod: 'ambiguous',
    alternativeMatches: inferredMatch?.alternatives ?? []
  }
}
```

---

## Deduplication

### Similarity Detection

```typescript
// lib/bug-intake/deduplication.ts

export interface DuplicationCheck {
  isDuplicate: boolean
  duplicateOfId: string | null
  similarity: number // 0-1
  relatedReportIds: string[]
}

export async function checkForDuplicates(
  bugReport: Partial<BugReport>,
  projectId: string
): Promise<DuplicationCheck> {

  // Get recent bug reports for this project (last 30 days)
  const recentReports = await db.query.bugReports.findMany({
    where: and(
      eq(bugReports.projectId, projectId),
      gt(bugReports.createdAt, thirtyDaysAgo()),
      isNull(bugReports.deletedAt),
      ne(bugReports.status, 'CLOSED')
    )
  })

  if (recentReports.length === 0) {
    return { isDuplicate: false, duplicateOfId: null, similarity: 0, relatedReportIds: [] }
  }

  // Use embeddings for semantic similarity
  const newEmbedding = await getEmbedding(
    `${bugReport.title} ${bugReport.description} ${bugReport.errorMessage}`
  )

  const similarities = await Promise.all(
    recentReports.map(async (report) => {
      const reportEmbedding = await getEmbedding(
        `${report.title} ${report.description} ${report.errorMessage}`
      )
      return {
        reportId: report.id,
        similarity: cosineSimilarity(newEmbedding, reportEmbedding)
      }
    })
  )

  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity)

  // High similarity = duplicate
  if (similarities[0]?.similarity > 0.9) {
    return {
      isDuplicate: true,
      duplicateOfId: similarities[0].reportId,
      similarity: similarities[0].similarity,
      relatedReportIds: similarities
        .filter(s => s.similarity > 0.6)
        .map(s => s.reportId)
    }
  }

  // Medium similarity = related
  const related = similarities
    .filter(s => s.similarity > 0.6)
    .map(s => s.reportId)

  return {
    isDuplicate: false,
    duplicateOfId: null,
    similarity: similarities[0]?.similarity ?? 0,
    relatedReportIds: related
  }
}
```

---

## API Endpoints

### POST `/api/bug-reports/intake`

Unified intake endpoint.

```typescript
// app/api/bug-reports/intake/route.ts

import { z } from 'zod'

const intakeSchema = z.object({
  source: z.enum(['EMAIL', 'CHAT', 'FORM', 'SLACK', 'API', 'PORTAL']),
  sourceId: z.string().optional(),

  rawSubject: z.string().optional(),
  rawBody: z.string(),

  senderEmail: z.string().email(),
  senderName: z.string().optional(),

  attachments: z.array(z.object({
    filename: z.string(),
    mimeType: z.string(),
    url: z.string().url().optional(),
    base64: z.string().optional(),
  })).optional(),

  metadata: z.record(z.unknown()).optional(),

  // Pre-structured fields (for forms/API)
  title: z.string().optional(),
  stepsToReproduce: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
  errorMessage: z.string().optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  environment: z.record(z.unknown()).optional(),
})

export async function POST(req: Request) {
  // Validate API key for external sources
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || !isValidIntakeApiKey(apiKey)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid API key' },
      { status: 401 }
    )
  }

  const body = await req.json()
  const parsed = intakeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const intake = parsed.data

  // Process attachments (upload if base64)
  const attachmentUrls = await processAttachments(intake.attachments)

  // Create initial bug report
  const [bugReport] = await db.insert(bugReports).values({
    source: intake.source,
    sourceId: intake.sourceId,
    rawSubject: intake.rawSubject,
    rawBody: intake.rawBody,
    reporterEmail: intake.senderEmail,
    reporterName: intake.senderName,
    attachmentUrls,
    rawMetadata: intake.metadata,
    title: intake.title || 'Processing...', // Will be updated by parsing agent
    status: 'RECEIVED',
  }).returning()

  // Queue parsing job
  await queueBugParsing(bugReport.id)

  return NextResponse.json({
    ok: true,
    data: {
      id: bugReport.id,
      status: bugReport.status,
    }
  })
}
```

### GET `/api/bug-reports`

List bug reports with filtering.

```typescript
export async function GET(req: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const clientId = searchParams.get('clientId')
  const projectId = searchParams.get('projectId')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  // Build query with access control
  const reports = await fetchBugReports({
    userId: user.id,
    isAdmin: isAdmin(user),
    filters: { status, clientId, projectId },
    limit,
    offset,
  })

  return NextResponse.json({ ok: true, data: reports })
}
```

### GET `/api/bug-reports/:id`

Get single bug report with full details.

### PATCH `/api/bug-reports/:id`

Update bug report (linking, status changes, etc.).

### POST `/api/bug-reports/:id/retry-fix`

Retry autonomous fix for a failed bug.

### POST `/api/bug-reports/:id/request-info`

Mark as needing more info, notify client.

### POST `/api/bug-reports/:id/escalate`

Escalate to human intervention.

---

## Chat Widget Integration

### Embeddable Widget

```typescript
// Client-side script to embed on client websites

interface BugReportWidget {
  init: (config: {
    clientId: string
    projectId?: string
    apiKey: string
    position?: 'bottom-right' | 'bottom-left'
    theme?: 'light' | 'dark'
  }) => void

  open: () => void
  close: () => void

  // Pre-fill fields
  setContext: (context: {
    pageUrl?: string
    userEmail?: string
    userName?: string
    customFields?: Record<string, string>
  }) => void
}

// Usage:
// <script src="https://portal.placetostand.co/widget.js"></script>
// <script>
//   BugReportWidget.init({
//     clientId: 'client-uuid',
//     apiKey: 'widget-api-key'
//   });
// </script>
```

---

## Client Notification

### Automatic Updates

```typescript
// lib/bug-intake/notifications.ts

export async function notifyClientOfBugStatus(
  bugReport: BugReport,
  status: string,
  details?: string
) {
  if (!bugReport.reporterEmail) return

  const templates = {
    RECEIVED: {
      subject: `Bug report received: ${bugReport.title}`,
      body: `We've received your bug report and our system is analyzing it.`
    },
    FIX_IN_PROGRESS: {
      subject: `Working on your bug: ${bugReport.title}`,
      body: `Our automated system is working on a fix for this issue.`
    },
    PR_CREATED: {
      subject: `Fix ready for review: ${bugReport.title}`,
      body: `A fix has been created and is being reviewed. We'll update you once it's deployed.`
    },
    PR_MERGED: {
      subject: `Bug fixed: ${bugReport.title}`,
      body: `Great news! The fix has been deployed. ${details || ''}`
    },
    NEEDS_INFO: {
      subject: `More information needed: ${bugReport.title}`,
      body: `We need some additional information to fix this issue. ${details || ''}`
    },
    FAILED: {
      subject: `Update on your bug report: ${bugReport.title}`,
      body: `Our automated system couldn't resolve this issue. A team member will look into it shortly.`
    },
  }

  const template = templates[status as keyof typeof templates]
  if (!template) return

  await sendEmail({
    to: bugReport.reporterEmail,
    subject: template.subject,
    body: template.body,
    replyTo: 'support@placetostand.co',
    metadata: {
      bugReportId: bugReport.id,
      status,
    }
  })

  // Update last client update timestamp
  await db.update(bugReports)
    .set({
      lastClientUpdateAt: new Date().toISOString(),
      clientNotified: true,
    })
    .where(eq(bugReports.id, bugReport.id))
}
```

---

## Error Handling

### Parsing Failures

```typescript
async function handleParsingFailure(
  bugReportId: string,
  error: Error
) {
  await db.update(bugReports)
    .set({
      status: 'NEEDS_HUMAN',
      statusReason: `Parsing failed: ${error.message}`,
    })
    .where(eq(bugReports.id, bugReportId))

  // Alert team
  await sendAlert({
    type: 'BUG_PARSING_FAILED',
    bugReportId,
    error: error.message,
  })
}
```

### Linking Failures

```typescript
async function handleLinkingFailure(
  bugReportId: string,
  result: LinkingResult
) {
  if (result.alternativeMatches.length > 0) {
    // Present options to team
    await db.update(bugReports)
      .set({
        status: 'NEEDS_HUMAN',
        statusReason: `Ambiguous match: ${result.alternativeMatches.length} possible projects`,
        rawMetadata: sql`raw_metadata || ${JSON.stringify({ alternativeMatches: result.alternativeMatches })}::jsonb`,
      })
      .where(eq(bugReports.id, bugReportId))
  } else {
    // Unknown sender
    await db.update(bugReports)
      .set({
        status: 'NEEDS_HUMAN',
        statusReason: 'Could not identify client or project',
      })
      .where(eq(bugReports.id, bugReportId))
  }
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Each source adapter correctly transforms input
- [ ] Bug parsing agent extracts correct fields
- [ ] Linking engine matches correctly
- [ ] Deduplication detects similar bugs

### Integration Tests
- [ ] Full intake flow from API to stored bug report
- [ ] Email → bug report flow
- [ ] Client notifications sent correctly

### Test Data
- Sample bug reports from each source
- Edge cases: missing info, ambiguous projects, duplicates

---

## Success Criteria

1. **Intake Success Rate:** >99% of submissions successfully stored
2. **Parsing Accuracy:** >90% of fields correctly extracted
3. **Linking Accuracy:** >95% of bugs linked to correct project
4. **Deduplication:** <5% duplicate bugs slip through
5. **Time to Parse:** <30 seconds from intake to READY status

---

## Files to Create

```
lib/
├── bug-intake/
│   ├── types.ts                 # Type definitions
│   ├── intake.ts                # Main intake processing
│   ├── parsing-agent.ts         # AI parsing
│   ├── linking.ts               # Project linking
│   ├── deduplication.ts         # Duplicate detection
│   ├── notifications.ts         # Client notifications
│   ├── adapters/
│   │   ├── email.ts
│   │   ├── chat.ts
│   │   ├── form.ts
│   │   ├── slack.ts
│   │   └── api.ts
│   └── index.ts
├── queries/
│   └── bug-reports.ts
├── data/
│   └── bug-reports/
│       └── index.ts
app/
├── api/
│   └── bug-reports/
│       ├── intake/
│       │   └── route.ts
│       ├── [id]/
│       │   ├── route.ts
│       │   ├── retry-fix/
│       │   │   └── route.ts
│       │   ├── request-info/
│       │   │   └── route.ts
│       │   └── escalate/
│       │       └── route.ts
│       └── route.ts
public/
└── widget.js                    # Embeddable chat widget
```

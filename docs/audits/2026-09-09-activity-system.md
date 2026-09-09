# Activity system audit — 2026-09-09

Scope: `activity_logs`, the event writers in `apps/internal/lib/activity/events/`, every
mutation surface in `apps/internal` (server actions, API routes, CLI API, webhooks, cron),
the feed UI in `apps/internal/components/activity/`, and the dashboard "Recent Activity
Overview" summary route.

Counts below come from the local dev database (7,235 rows, Nov 2025 → Sep 2026). Production
proportions will differ but the shape of the problem is the same.

## Summary

The activity table is doing two jobs badly instead of one job well. About half of it is page
views nobody reads, a third of the verbs that are declared are never written, and a dozen
important mutations (lead stage moves, time-log edits, attachments, client update emails)
write nothing at all. On the read side, every feed rendered raw HTML and UUIDs for diffs,
and the AI briefing was summarising the *oldest* 200 events of its window, not the newest.

This PR fixes the read side and the two worst write-side problems. The remaining gaps are
listed with priorities under **Recommendations**.

## What this PR changes

| Area | Change |
|---|---|
| Model | Dashboard summary moved from `google/gemini-3-flash` to `google/gemini-3.5-flash-lite` at `reasoning: 'low'` (`app/api/dashboard/recent-activity/summary/route.ts`). |
| Summary correctness | `fetchActivityLogsSince` now takes the newest 200 rows and reverses them. It previously ordered ascending with a limit, so any window with more than 200 events was summarised from its start. The prompt now takes the last 50 of those, not the first 50. |
| Summary noise | View rows are excluded from the "active projects" metric and from the prompt. `TARGET_LABELS` gained the five target types that were falling through as raw enum strings. |
| Pagination | Feed cursor is now `created_at|id` with a matching `ORDER BY created_at DESC, id DESC`, so rows sharing a timestamp page deterministically. The bare-timestamp cursor is still accepted. |
| View logging removed | `ViewLogger` and its two mounts (`projects-board.tsx`, `client-detail.tsx`) are gone. `PROJECT_VIEWED` / `CLIENT_VIEWED` were 3,483 of 7,235 rows (48%) with no consumer. Historical rows are kept but hidden from every feed via `RETIRED_VERBS` in `lib/activity/queries.ts`. `INVOICE_VIEWED` (a client opening a shared invoice) is unaffected. |
| Comments in project feed | The project Activity tab now includes `COMMENT` rows, matching its own description. |
| Feed design | Rewritten: day grouping, timeline rail with a verb icon per row, actor avatar inline, source badge only for CLI/System, absolute time on hover. |
| Diff rendering | New `lib/activity/changes.ts` normalises all three stored diff shapes into typed field changes. Dates, money, hours, enums and statuses format properly; owner/assignee/contact/project ids resolve to names via a batched lookup (`lib/activity/references.ts`). Description and notes edits render as a collapsed word-level diff (`lib/activity/text-diff.ts`, dependency-free). |

## Findings

### 1. Noise

| # | Source | Rows (local) | Value | Status |
|---|---|---|---|---|
| N1 | `PROJECT_VIEWED` — one row per project **tab** mount (five tab routes each remount the board) | 3,139 | none | **removed** |
| N1 | `CLIENT_VIEWED` | 344 | none; never rendered anywhere | **removed** |
| N2 | `TASK_UPDATED` with `changedFields: ['status']` (sheet save) vs `TASK_STATUS_CHANGED` (board drag) for the same semantic event | ~1,100 + ~50 | duplicated semantics | open |
| N3 | `HOUR_BLOCK_CREATED` fans out one row per invoice line item with no `target_id`, and the log fires even when `onConflictDoNothing` inserted nothing (webhook replay = duplicate rows) — `lib/data/invoices.ts:81-116` | 40 | low | open |
| N4 | `TASK_COMMENT_UPDATED` logged on no-op saves, from the browser, after the fact — `use-task-comments/mutations.ts:259` | small | low | open |
| N5 | `MONTHLY_CLOSE_CLOSED` emitted identically for close and re-close — `lib/data/reports/close.ts:310,400` | 10 | misleading | open |
| N6 | Two `OAUTH_CONNECTED` writers with different payloads; disconnect defaults to `ADMIN_UI` while connect says `SYSTEM` — `lib/integrations/connections.ts:188,251`, `api/auth/callback/github/route.ts:126` | 18 | inconsistent | open |
| N7 | Invoice save pushes up to three `changedFields` for one edit and records `notes` with no before/after — `save-invoice.ts:287-315` | 1 | misleading | open |

### 2. Coverage gaps (mutations that write no activity row)

**P0 — user-visible history is missing**

| # | Mutation | Where | Note |
|---|---|---|---|
| G1 | Lead stage move | `leads/_actions/move-lead.ts:102` | The most-used lead action. `LEAD_STATUS_CHANGED` is declared and dead; history only reaches `lead_stage_history`. |
| G2 | Lead create / update | `leads/_actions/save-lead.ts:79,163` | `LEAD_CREATED` / `LEAD_UPDATED` dead. |
| G3 | Lead archive / restore / hard delete | `archive-lead.ts:37`, `restore-lead.ts:37`, `destroy-lead.ts:37` | A destroyed lead leaves no trace. |
| G4 | Task comment create/edit/delete via the web API | `api/tasks/[taskId]/comments/route.ts:65-101`, `api/task-comments/[commentId]/route.ts:29,71` | Logging lives only in the React hook, one extra round-trip after the mutation. The CLI comment route was fixed for this; the browser route was not. |
| G5 | Time log edit and delete | `api/projects/[projectId]/time-logs/[timeLogId]/route.ts:29,58` | Only create is logged, and only client-side. Billable hours can change with no record. |
| G6 | Time log create via API (non-browser) | `api/projects/[projectId]/time-logs/route.ts:139` | Same client-only weakness. |
| G7 | Task attachments add/remove | `projects/actions/task-helpers.ts:45` | `buildTaskUpdateEvent` ignores attachments entirely. |
| G8 | Client update emails: draft, edit, send | `updates/[updateId]/actions.ts:55,86`, `lib/updates/send.ts:59`, `api/cli/v1/updates/route.ts:28` | Outbound client-facing email with no audit row. Reachable by agents via the CLI API. |
| G9 | Client notes edited from the client detail page | `clients/[clientSlug]/actions.ts:24` | Same edit from the settings sheet *is* logged. |
| G10 | Contact ↔ client links (portal access grants) | `lib/queries/contacts/settings/contact-clients.ts:167`, `lib/queries/clients/settings/client-contacts.ts:144` | These rows grant or revoke portal access. |
| G11 | Planning sessions / threads / revisions | `lib/queries/planning.ts`, `projects/actions/planning.ts:42,100` | No verbs exist; only the final `WORKER_PLAN_REQUESTED` is visible. |
| G12 | Worker status sync mutating tasks | `projects/actions/fetch-worker-status.ts:185,199` | A read-shaped action writes `tasks.workerStatus` and GitHub issue fields on every poll. |

**P1**

G13 lead-update edit/delete · G14 contact insert inside lead conversion · G15/G16 portal user creation (`promote-to-user.ts`, `find-or-create-portal-user.ts`) · G17 self-service profile/password change · G18 auth events (password reset, magic link) · G19/G20 product catalog and tax rate edits · G22/G23 inbound form submissions and leads-intake webhook arrivals · G24 cron `abandon-stale-submissions` · G25 my-tasks reorder · G27 `getOrCreateSalesProject` bypasses `saveProject`.

**CLI API:** actor attribution is correct (bearer token → real admin user), but `source: 'CLI'` is passed at only three call sites. Any CLI route that reuses a browser server action records `ADMIN_UI`. `POST /api/cli/v1/updates` creates a client-update draft with no log at all.

### 3. Actor and source handling

| # | Problem | Where |
|---|---|---|
| A1 | `/api/activity/log` accepts any `verb` in the enum and any `summary` string from the browser. Actor spoofing is blocked; **event forgery is not**. | `api/activity/log/route.ts:23-38` |
| A2 | `DEFAULT_SOURCE = 'ADMIN_UI'` means any webhook or cron path that forgets `source` is indistinguishable from a human click. | `lib/activity/logger.ts:28` |
| A3 | Stripe `INVOICE_PAID` and hour-block creation logs are fire-and-forget inside a serverless handler, so they are best-effort. | `api/integrations/stripe/route.ts:47-56` |
| A4 | `INVOICE_UNSENT` and `LEAD_CONVERTED` omit `targetClientId`, so they never appear in a client-scoped feed. | `unsend-invoice.ts:77`, `convert-lead.ts:215` |
| A5 | Repo link/unlink hardcode `actorRole: 'ADMIN'` instead of reading it. | `lib/data/github-repos/index.ts:86,120` |

### 4. Schema and dead surface

- `deleted_at`, `restored_at`, `updated_at` on `activity_logs` are never written. Four of five indexes carry a `WHERE deleted_at IS NULL` predicate that can never be false; `includeDeleted` is dead API.
- `idx_activity_logs_actor_id` and `idx_activity_logs_client` serve no query.
- No index leads with `target_type` + `created_at`. The global per-entity feeds (`/projects/activity`, `/clients/activity`, …) filter on `target_type` alone and scan `created_at DESC` until they fill a page. Cheap today; add `(target_type, created_at DESC)` before the table grows.
- 31 declared verbs are never emitted (all `PROPOSAL_*`, most `LEAD_*`, `TASK_CREATED_FROM_*`, `PR_*`, `OAUTH_REFRESHED/EXPIRED`, `WORKER_IMPLEMENT_REQUESTED`). Historical `PROPOSAL_*` rows exist from a removed feature; the renderer handles unknown verbs, so the enum can be pruned safely.
- No retention or pruning exists.
- `activity_overview_cache.summary` is a `text` column holding JSON.

### 5. Payload consistency

Three diff shapes coexisted and only one rendered:

| Shape | Writers | Rendered before this PR |
|---|---|---|
| `details.{before,after}` | tasks (sheet/CLI), clients, projects, invoices, hour blocks, users | yes, as raw values |
| `details.<field>.{from,to}` | `change-task-due-date.ts:90` (465 rows) | **no** |
| top-level `status.{from,to}` | `TASK_STATUS_CHANGED` (1,078 rows) | **no** |
| `assignees` / `contractors` / `members` `{added,removed}` | tasks, projects, clients | assignees as a count only; the others not at all |

`lib/activity/changes.ts` now reads all of them. The writers should still converge on `details.{before,after}` so the next renderer does not need three parsers.

## Recommendations, in order

1. **Log lead stage moves, creates, and archives** (G1–G3). Highest user-visible gap; the verbs already exist.
2. **Move comment and time-log logging server-side** (G4–G6) into the API routes, with a no-op guard on comment edits. Removes the only client-side audit path besides the now-deleted view logger.
3. **Log client update drafts and sends** (G8), including the CLI route.
4. **Log attachments** in `buildTaskUpdateEvent` (G7).
5. **Unify the status verb** (N2): have `updateTaskForActor` emit `TASK_STATUS_CHANGED` when status is the only change.
6. **Converge writers on `details.{before,after}`** (`change-task-due-date.ts`, `taskStatusChangedEvent`, `clientCreatedEvent`, `save-contact.ts`).
7. **Tighten `/api/activity/log`** (A1): restrict it to the verbs the browser is still allowed to write (comments and time logs until item 2 lands), then delete it.
8. **Prune dead verbs and unused indexes**, add `(target_type, created_at DESC)`, and decide on a retention window.
9. **One-time cleanup** of historical view rows, once you are happy the feeds look right without them:

   ```sql
   delete from activity_logs where verb in ('PROJECT_VIEWED', 'CLIENT_VIEWED');
   ```

   Non-urgent: the rows are already hidden from every feed and the summary prompt.

## Implementation status (follow-up PR, 2026-09-09)

Every finding and recommendation above was actioned in the follow-up PR:

| Item | Status |
|---|---|
| G1–G3 lead stage / create / update / archive / restore / delete | Logged (`LEAD_STATUS_CHANGED`, `LEAD_CREATED`, `LEAD_UPDATED` with diff, `LEAD_ARCHIVED`, `LEAD_RESTORED`, `LEAD_DELETED`) |
| G4–G6 comments and time logs | Logging moved into the shared query helpers so browser, CLI and any future caller share one path; no-op comment edits skip; `TIME_LOG_UPDATED` / `TIME_LOG_DELETED` added. Browser log endpoint and `lib/activity/client.ts` deleted. |
| G7 attachments | `TASK_ATTACHMENT_ADDED` / `_REMOVED` from `syncAttachments` |
| G8 client update emails | `CLIENT_UPDATE_DRAFTED` / `_EDITED` / `_SENT` in the shared lib; CLI route passes `source: 'CLI'` |
| G9 client notes from detail page | `CLIENT_UPDATED` with before/after |
| G10 contact ↔ client links | `CONTACT_CLIENT_LINKED` / `_UNLINKED` |
| G11 planning | `PLANNING_SESSION_CREATED`, `PLAN_REVISION_CREATED` (on completed generation only) |
| G12 worker status sync | `TASK_WORKER_STATUS_CHANGED` on transitions only, `source: 'SYSTEM'` |
| G13–G27 (P1) | Lead-update edit/delete, contact created in conversion, portal user create/restore, self-service profile and password changes, product catalog and tax rates, submission intake, leads intake, cron abandon sweep, sales-project creation: all logged. My-tasks reorder intentionally stays silent (pure ordering). |
| N2 status verb | Sheet saves that only change status now emit `TASK_STATUS_CHANGED` |
| N3 hour-block fan-out | One row per invoice, gated on rows actually inserted |
| N5 re-close | `MONTHLY_CLOSE_RECLOSED` |
| N6 OAuth writers | Single builder pair, consistent source, no re-log on re-auth |
| N7 invoice badges | One badge per change, notes with before/after |
| A1 browser log endpoint | Deleted |
| A3 fire-and-forget | Stripe and hour-block logs awaited |
| A4 missing `targetClientId` | Fixed on `INVOICE_UNSENT`, `LEAD_CONVERTED`, `CONTACT_INVITED_TO_PORTAL` |
| A5 hardcoded role | Read from the acting user |
| Shape convergence | All writers use `details.{before,after}`; the renderer keeps parsers for the two legacy shapes on historical rows |
| Dead verbs / target types | Pruned from `ActivityVerbs`; `PROPOSAL` and `GENERAL` removed |
| Schema | `updated_at` / `deleted_at` / `restored_at` dropped, two unused indexes dropped, `(target_type, created_at desc)` added, cache `summary` is jsonb (migration `0076`) |
| Retention | Weekly cron `/api/cron/prune-activity-logs`, `ACTIVITY_LOG_RETENTION_DAYS` (default 730) |
| Historical view rows | Deleted in migration `0076` |
| A2 default `ADMIN_UI` source | Kept as the default for user actions; every webhook, cron, and intake writer now passes `source: 'SYSTEM'` explicitly, and the CLI routes pass `'CLI'`. |

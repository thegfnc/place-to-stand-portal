# PRD-006: Portal Interaction Performance Initiative

## 1. Overview

### 1.1 Problem Statement

The portal consistently registers 300 ms+ pauses across critical interactions (Projects Board, task sheet, navigation return after idle). Each click often triggers redundant server fetches, heavy payloads, and blocking UI transitions without feedback. These bottlenecks compound when caches expire or the app has been idle, leading users to assume their actions did not register. The current architecture lacks consistent instrumentation, so regressions go unnoticed until they become systemic.

### 1.2 Goal

Deliver a responsive portal experience where common interactions (task sheet open, board navigation, settings forms, idle resume) appear to respond immediately while background data work proceeds without blocking. Establish instrumentation and architectural patterns that keep end-to-end latency predictable (<150 ms P95 for core UI interactions) and reduce redundant data transfers throughout the app.

### 1.3 Project Scope

- Projects Board interactions (task sheet, drag/drop feedback, board/backlog/calendar transitions).
- Cross-app navigation responsiveness (App Router transitions, idle-to-active resume logic).
- Data fetching and caching patterns that impact perceived latency (projects/tasks, settings tables, dashboard widgets).
- Loading states, user feedback, and instrumentation for performance-critical flows.

### 1.4 Out of Scope

- New product features unrelated to performance.
- Non-portal clients (mobile apps, integrations) unless they depend on shared APIs being refactored.
- Global infra upgrades (CDN, new database tier); focus is application-level responsiveness.

## 2. Current State & Key Observations

1. **Task Sheet Latency** – Opening a task pushes an App Router navigation that refetches the entire projects graph (`fetchProjectsWithRelations` + aggregates) before rendering the sheet, yielding 300–600 ms delays with no loading feedback (`scrimLocked` never resets).
2. **Idle Resume Cold Starts** – Returning after inactivity replays wide queries and hydration work before input is processed, causing multi-second stalls in extreme cases.
3. **Navigation & Tab Switching** – Moving between board/backlog/calendar or dashboard widgets re-runs broad data fetches instead of reusing cached slices; transitions block UI threads.
4. **No Warm Cache Benefit** – Revisiting a project, task, or settings section re-executes the full server graph because the App Router remounts the page and our Drizzle queries bypass Next’s cache (`cache()` never hits when parameters change), so second visits are just as slow as first.
5. **Background Data Refreshes** – Supabase live updates trigger redundant client recomputation (full project scans to locate tasks), adding work on hot paths.
6. **Settings & Management Areas** – Client management, project settings, hour tracking, and dashboard widgets load complete data snapshots for every tab visit instead of reusing state or paginating; edits force full reloads.
7. **Loading State Inconsistency** – Many components lack optimistic feedback, so the portal appears frozen during async work.
8. **Instrumentation Gaps** – Little visibility into interaction timing (no PostHog event timings, limited Web Vitals marks). We cannot correlate database time to user perception.

## 3. Success Metrics

### 3.1 Runtime KPIs (monitored post-merge)

- **Interaction latency**: P95 under 150 ms desktop / 200 ms mobile for task sheet open, board tab switches, dashboard widget refresh (captured via User Timing + PostHog trends).
- **Reduced redundant fetches**: ≥70 % decrease in full-project payload requests triggered by UI interactions (compare PostHog funnel metrics/DB logs pre/post).
- **Payload size**: Average response size for projects/task endpoints reduced by ≥40 %.
- **Idle resume recovery**: Time to first actionable paint after idle under 250 ms P95.
- **User feedback**: Progress indicators appear within 50 ms whenever async work exceeds 100 ms; validated by QA checklist.

### 3.2 Implementation Deliverables (checked in CI/review)

- **Instrumentation helpers** (`lib/perf/interaction-marks.ts`): Expose `markInteraction()` that emits `performance.mark` and forwards timing metadata to PostHog.
- **PostHog configuration**: PostHog Next.js middleware + client SDK configured with custom events for `task_sheet.open`, `dashboard.refresh`, `settings.save`, router transition capture, and sampling tuned for internal usage [^posthog].
- **Cache diagnostics**: Script (`npm run perf:report`) logging React Query cache hits/misses for board, dashboard, and settings flows; documented usage in README.
- **Runbook**: Shared document describing React Query key namespaces, invalidation triggers (mutations, Supabase events), and troubleshooting steps.

## 4. Requirements

### 4.1 Functional Requirements

1. **Instant feedback** – All high-traffic interactions (Projects Board, dashboard, settings, reports, onboarding flows) must present immediate UI feedback (sheet/dialog open, button state change, skeleton) before network activity completes.
2. **Optimistic routing & navigation** – Route transitions and tab switches anywhere in the portal should not block on server data when the relevant client state is already available; deep-link updates occur asynchronously.
3. **Persistent client caching** – Reuse previously loaded data via TanStack Query (React Query) or equivalent stores across all domains so revisits hit a warm cache; define clear invalidation semantics after mutations.
4. **Selective data reload** – Fetch only the minimal dataset needed for each surface (project-scoped tasks, targeted settings pages, paginated lists, incremental diffs) instead of broad snapshots.
5. **Consistent state** – Maintain eventual consistency via existing refresh queues/Supabase listeners and mutation-based invalidation without reprocessing entire collections.
6. **Idle-aware prefetching** – When users return from idle or show intent (hover/focus), prefetch critical slices in the background and reuse caches for any page.
7. **Instrumentation hooks** – Add reusable utilities to mark start/end of interactions and stream timing data to PostHog across all app features.
8. **PostHog analytics** – Configure and verify PostHog event capture (router transitions, custom interaction events, session replay if enabled) to measure perceived performance [^posthog].

### 4.2 Non-Functional Requirements

1. **Authorization & RBAC** – Continue using the existing guard helpers; no regressions in permission handling.
2. **Type safety** – Update shared types/DTOs to reflect new data shapes; prohibit `any`.
3. **Observability** – Align with internal PostHog/analytics rules for event naming and privacy; integrate with Web Vitals and structured logging.
4. **Accessibility** – Preserve keyboard navigation/focus when interactions become optimistic; announce loading states for assistive tech.
5. **Manual validation** – Maintain a manual QA checklist covering key interactions, idle-resume cases, and perceived-speed indicators.
6. **Documentation** – Update README, developer notes, and relevant PRDs to reflect new patterns.

## 5. Implementation Strategy

Deliver improvements incrementally, prioritizing instrumentation and highest-impact interactions.

### Phase 0 – Instrumentation & Baselines

- Add PostHog events and `performance.mark` wrappers for task sheet open, board tab switch, dashboard widget refresh, and idle resume.
- Capture baseline metrics across staging/prod via PostHog dashboards; establish alert thresholds.
- Document dashboards/queries and align with ops.

### Phase 1 – Interaction Responsiveness

Deliver optimistic feedback patterns surface by surface while introducing shared primitives.

#### Projects Board

- Open task sheets, time-log dialogs, and drag interactions immediately while syncing URLs in the background.
- Reset `scrimLocked` and related guards; ensure hover/drag states remain interactive during background fetches.
- Standardize board/backlog/calendar loading indicators with reusable skeleton components.

#### Dashboard & Reports

- Add optimistic widget refreshes, filter changes, and metric detail drawers with visible progress states.
- Prevent dashboard route transitions from blocking on aggregate recomputation by reusing existing widget data until refresh completes.

#### Settings, Admin, and Management

- Convert settings forms and tables (clients, members, hours, templates) to open instantly with cached data, displaying inline skeletons while mutations sync.
- Ensure tab switches reuse prior state; highlight optimistic saves and show toast/error fallbacks.

#### Shared UX Infrastructure

- Publish an optimistic interaction hook, skeleton kit, and loading-state guidelines for use across new features.
- Document focus management and accessibility rules for optimistic components.

### Phase 2 – Data Fetch & Caching Rework

Introduce shared caching patterns and slimmer data loaders per surface.

#### Projects Board

- Break `fetchProjectsWithRelations` into reusable slices and expose project-scoped task APIs for sheet hydration, drag/drop updates, and review flows.
- Attach TanStack Query caches to columns, task details, and review lists with background revalidation and mutation-aware invalidation.
- Implement hover/intent-based prefetching for task details, neighboring columns, and review actions.

#### Dashboard & Reports

- Replace monolithic dashboard fetches with widget-scoped endpoints and query caches keyed by filters and time ranges.
- Move report detail routes to incremental fetches that reuse cached summaries rather than recomputing the entire dataset.

#### Settings, Admin, and Management

- Provide paginated, scoped endpoints for clients, members, hour logs, templates, and permissions; hydrate via React Query with optimistic mutations.
- Persist cached table data across tab switches; invalidate only the collections touched by a mutation or Supabase event.

#### Server Caching & Database Tuning

- Apply `unstable_cache`, cache tags, or ISR to narrow API routes so repeated server hits share work while honoring Supabase-triggered invalidation.
- Tune Drizzle queries and add supporting indexes to eliminate redundant per-item aggregates now resolved via cached counts.
- Publish a cache key registry mapping React Query keys to Supabase channels and invalidation triggers.

### Phase 3 – Idle Resume & Edge Cases

Harden cache reuse when the user returns from idle or navigates via history controls.

#### Projects Board

- On visibility change, trigger lightweight diffs that reconcile cached task collections instead of reloading the board route.
- Wire Supabase change events into the shared cache, updating only affected tasks and columns without rescanning projects.

#### Dashboard & Reports

- Resume dashboards with cached widget data first, then refresh metrics in the background while flagging stale values when refresh fails.
- Ensure historical report routes hydrate from cache when navigating back or forward.

#### Settings, Admin, and Management

- Persist table filters and selections across navigation; reuse cached data on return and refetch only the affected pages.
- Handle long-running mutations (bulk invites, hour imports) with progress indicators that survive navigation and idle.

#### Cross-App Validation

- Guarantee deep links, browser navigation, and direct URLs remain functional with optimistic loading and cache hydration across surfaces.
- Conduct manual QA passes covering idle resume, back button flows, cache reuse, and high-traffic interaction loops in projects, dashboard, and settings.
- Manually verify cache invalidation rules (mutation triggers, Supabase events) update React Query stores without reloading routes.

### Phase 4 – Verification & Knowledge Share

- Audit PostHog dashboards to confirm custom events/marks are flowing; configure alerts for regressions.
- Capture before/after metrics through manual benchmarking, update the performance runbook, and share findings in engineering syncs.
- Pair with adjacent teams to adopt the shared caching/instrumentation primitives.

## 6. Risks & Mitigations

- **State divergence** – Optimistic UIs may show stale data. Mitigate with refresh queues, stale indicators, and reconciliation on mutation success.
- **Route desynchronization** – Delayed router updates could break deep links. Require navigation-centric QA and ensure final URLs sync.
- **Instrumentation overhead** – Event capture adds cost; sample judiciously and reuse shared helpers.
- **Complex rollout** – Multi-area changes risk regressions; rely on telemetry, manual regression checklists, and staggered deploys to catch issues early.
- **Team adoption** – New caching/optimistic patterns demand onboarding; schedule workshops and update docs.

## 7. Dependencies & Collaboration

- Data engineering for Drizzle query adjustments and potential index creation.
- Ops/observability for PostHog pipeline management, dashboards, and alerting.
- Frontend/product design for loading feedback UX alignment.
- QA for manual regression runs aligned to the perceived-speed checklist.
- Stakeholders (PMs) for prioritizing hot spots beyond the Projects Board.

## 8. Rollout Plan & Validation

1. Ship Phase 0 instrumentation to staging/prod; capture baseline dashboards in PostHog.
2. Deploy Phase 1 surface improvements sequentially (board, dashboard, settings), running the manual perceived-speed checklist after each deployment.
3. Roll out Phase 2 caching changes per surface, tracking PostHog event latency and DB load after each release.
4. Validate Phase 3 idle-resume work with manual QA scripts and PostHog visibility-change metrics.
5. Conclude Phase 4 by publishing before/after metrics, archiving dashboards, and updating the performance runbook.

## 9. Open Questions

1. Which additional surfaces (e.g., client settings, activity feed) contribute the most to perceived slowness and should be prioritized after Projects Board?
2. Do we consolidate around React Query for all client-side caching, or are there contexts where server components + cache remain preferable?
3. How aggressively should we prefetch after idle—immediately on focus or deferred until user interaction?
4. What alert thresholds will product/ops consider actionable for interaction latency regressions?
5. Are there dependencies on the full `fetchProjectsWithRelations` payload (analytics, exports) that require alternative endpoints when we slim it down?

[^posthog]: PostHog for Next.js setup guide covering client/server instrumentation, autocapture, and session replay configuration, at https://posthog.com/docs/libraries/nextjs.

# PRD-006: Portal Interaction Performance Initiative

## 1. Overview

### 1.1 Problem Statement

The portal consistently registers 300 ms+ pauses across critical interactions (Projects Board, task sheet, navigation return after idle). Each click often triggers redundant server fetches, heavy payloads, and blocking UI transitions without feedback. These bottlenecks compound when caches expire or the app has been idle, leading users to assume their actions did not register. The current architecture lacks consistent instrumentation, so regressions go unnoticed until they become systemic.

### 1.2 Goal

Deliver a responsive portal experience where common interactions (task sheet open, board navigation, settings forms, idle resume) appear to respond immediately while background data work proceeds without blocking. Establish instrumentation and architectural patterns that keep end-to-end latency predictable (<150 ms P95 for core UI interactions) and reduce redundant data transfers throughout the app.

### 1.3 Project Scope

- Projects Board interactions (task sheet, drag/drop feedback, board/backlog/calendar transitions).
- Cross-app navigation responsiveness (App Router transitions, idle-to-active resume logic).
- Data fetching and caching patterns that impact perceived latency (projects/tasks, settings tables, dashboard widgets).
- Loading states, user feedback, and instrumentation for performance-critical flows.

### 1.4 Out of Scope

- New product features unrelated to performance.
- Non-portal clients (mobile apps, integrations) unless they depend on shared APIs being refactored.
- Global infra upgrades (CDN, new database tier); focus is application-level responsiveness.

## 2. Current State & Key Observations

1. **Task Sheet Latency** – Opening a task pushes an App Router navigation that refetches the entire projects graph (`fetchProjectsWithRelations` + aggregates) before rendering the sheet, yielding 300–600 ms delays with no loading feedback (`scrimLocked` never resets).
2. **Idle Resume Cold Starts** – Returning after inactivity replays wide queries and hydration work before input is processed, causing multi-second stalls in extreme cases.
3. **Navigation & Tab Switching** – Moving between board/backlog/calendar or dashboard widgets re-runs broad data fetches instead of reusing cached slices; transitions block UI threads.
4. **No Warm Cache Benefit** – Revisiting a project, task, or settings section re-executes the full server graph because the App Router remounts the page and our Drizzle queries bypass Next’s cache (`cache()` never hits when parameters change), so second visits are just as slow as first.
5. **Background Data Refreshes** – Supabase live updates trigger redundant client recomputation (full project scans to locate tasks), adding work on hot paths.
6. **Settings & Management Areas** – Client management, project settings, hour tracking, and dashboard widgets load complete data snapshots for every tab visit instead of reusing state or paginating; edits force full reloads.
7. **Loading State Inconsistency** – Many components lack optimistic feedback, so the portal appears frozen during async work.
8. **Instrumentation Gaps** – Little visibility into interaction timing (no PostHog event timings, limited Web Vitals marks). We cannot correlate database time to user perception.

## 3. Success Metrics

### 3.1 Runtime KPIs (monitored post-merge)

- **Interaction latency**: P95 under 150 ms desktop / 200 ms mobile for task sheet open, board tab switches, dashboard widget refresh (captured via User Timing + PostHog trends).
- **Reduced redundant fetches**: ≥70 % decrease in full-project payload requests triggered by UI interactions (compare PostHog funnel metrics/DB logs pre/post).
- **Payload size**: Average response size for projects/task endpoints reduced by ≥40 %.
- **Idle resume recovery**: Time to first actionable paint after idle under 250 ms P95.
- **User feedback**: Progress indicators appear within 50 ms whenever async work exceeds 100 ms; validated by QA checklist.

### 3.2 Implementation Deliverables (checked in CI/review)

- **Instrumentation helpers** (`lib/perf/interaction-marks.ts`): Expose `markInteraction()` that emits `performance.mark` and forwards timing metadata to PostHog.
- **PostHog configuration**: PostHog Next.js middleware + client SDK configured with custom events for `task_sheet.open`, `dashboard.refresh`, `settings.save`, router transition capture, and sampling tuned for internal usage [^posthog].
- **Cache diagnostics**: Script (`npm run perf:report`) logging React Query cache hits/misses for board, dashboard, and settings flows; documented usage in README.
- **Runbook**: Shared document describing React Query key namespaces, invalidation triggers (mutations, Supabase events), and troubleshooting steps.

## 4. Requirements

### 4.1 Functional Requirements

1. **Instant feedback** – All high-traffic interactions (Projects Board, dashboard, settings, reports, onboarding flows) must present immediate UI feedback (sheet/dialog open, button state change, skeleton) before network activity completes.
2. **Optimistic routing & navigation** – Route transitions and tab switches anywhere in the portal should not block on server data when the relevant client state is already available; deep-link updates occur asynchronously.
3. **Persistent client caching** – Reuse previously loaded data via TanStack Query (React Query) or equivalent stores across all domains so revisits hit a warm cache; define clear invalidation semantics after mutations.
4. **Selective data reload** – Fetch only the minimal dataset needed for each surface (project-scoped tasks, targeted settings pages, paginated lists, incremental diffs) instead of broad snapshots.
5. **Consistent state** – Maintain eventual consistency via existing refresh queues/Supabase listeners and mutation-based invalidation without reprocessing entire collections.
6. **Idle-aware prefetching** – When users return from idle or show intent (hover/focus), prefetch critical slices in the background and reuse caches for any page.
7. **Instrumentation hooks** – Add reusable utilities to mark start/end of interactions and stream timing data to PostHog across all app features.
8. **PostHog analytics** – Configure and verify PostHog event capture (router transitions, custom interaction events, session replay if enabled) to measure perceived performance [^posthog].

### 4.2 Non-Functional Requirements

1. **Authorization & RBAC** – Continue using the existing guard helpers; no regressions in permission handling.
2. **Type safety** – Update shared types/DTOs to reflect new data shapes; prohibit `any`.
3. **Observability** – Align with internal PostHog/analytics rules for event naming and privacy; integrate with Web Vitals and structured logging.
4. **Accessibility** – Preserve keyboard navigation/focus when interactions become optimistic; announce loading states for assistive tech.
5. **Manual validation** – Define and maintain a manual QA checklist covering key interactions and idle-resume cases.
6. **Documentation** – Update README, developer notes, and relevant PRDs to reflect new patterns.

## 5. Implementation Strategy

Deliver improvements incrementally, prioritizing instrumentation and highest-impact interactions.

### Phase 0 – Instrumentation & Baselines

- Add PostHog events and `performance.mark` wrappers for task sheet open, board tab switch, dashboard widget refresh, and idle resume.
- Capture baseline metrics across staging/prod; establish alert thresholds.
- Document dashboards/queries and align with ops.

### Phase 1 – Interaction Responsiveness

Deliver optimistic feedback patterns surface by surface while introducing shared primitives.

#### Projects Board

- Open task sheets, time-log dialogs, and drag interactions immediately while syncing URLs in the background.
- Reset `scrimLocked` and related guards; ensure hover/drag states remain interactive during background fetches.
- Standardize board/backlog/calendar loading indicators with reusable skeleton components.

#### Dashboard & Reports

- Add optimistic widget refreshes, filter changes, and metric detail drawers with visible progress states.
- Prevent dashboard route transitions from blocking on aggregate recomputation by reusing existing widget data until refresh completes.

#### Settings, Admin, and Management

- Convert settings forms and tables (clients, members, hours, templates) to open instantly with cached data, displaying inline skeletons while mutations sync.
- Ensure tab switches reuse prior state; highlight optimistic saves and show toast/error fallbacks.

#### Shared UX Infrastructure

- Publish an optimistic interaction hook, skeleton kit, and loading-state guidelines for use across new features.
- Document focus management and accessibility rules for optimistic components.

### Phase 2 – Data Fetch & Caching Rework

Introduce shared caching patterns and slimmer data loaders per surface.

#### Projects Board

- Break `fetchProjectsWithRelations` into reusable slices and expose project-scoped task APIs for sheet hydration, drag/drop updates, and review flows.
- Attach TanStack Query caches to columns, task details, and review lists with background revalidation and mutation-aware invalidation.
- Implement hover/intent-based prefetching for task details, neighboring columns, and review actions.

#### Dashboard & Reports

- Replace monolithic dashboard fetches with widget-scoped endpoints and query caches keyed by filters and time ranges.
- Move report detail routes to incremental fetches that reuse cached summaries rather than recomputing the entire dataset.

#### Settings, Admin, and Management

- Provide paginated, scoped endpoints for clients, members, hour logs, templates, and permissions; hydrate via React Query with optimistic mutations.
- Persist cached table data across tab switches; invalidate only the collections touched by a mutation or Supabase event.

#### Server Caching & Database Tuning

- Apply `unstable_cache`, cache tags, or ISR to narrow API routes so repeated server hits share work while honoring Supabase-triggered invalidation.
- Tune Drizzle queries and add supporting indexes to eliminate redundant per-item aggregates now resolved via cached counts.
- Publish a cache key registry mapping React Query keys to Supabase channels and invalidation triggers.

### Phase 3 – Idle Resume & Edge Cases

Harden cache reuse when the user returns from idle or navigates via history controls.

#### Projects Board

- On visibility change, trigger lightweight diffs that reconcile cached task collections instead of reloading the board route.
- Wire Supabase change events into the shared cache, updating only affected tasks and columns without rescanning projects.

#### Dashboard & Reports

- Resume dashboards with cached widget data first, then refresh metrics in the background while flagging stale values when refresh fails.
- Ensure historical report routes hydrate from cache when navigating back or forward.

#### Settings, Admin, and Management

- Persist table filters and selections across navigation; reuse cached data on return and refetch only the affected pages.
- Handle long-running mutations (bulk invites, hour imports) with progress indicators that survive navigation and idle.

#### Cross-App Validation

- Guarantee deep links, browser navigation, and direct URLs remain functional with optimistic loading and cache hydration across surfaces.
- Conduct manual QA passes covering idle resume, back button flows, cache reuse, and high-traffic interaction loops in projects, dashboard, and settings.
- Manually verify cache invalidation rules (mutation triggers, Supabase events) update React Query stores without reloading routes.

### Phase 4 – Verification & Knowledge Share

- Audit PostHog dashboards to confirm custom events/marks are flowing; configure alerts for regressions.
- Capture before/after metrics through manual benchmarking, update the performance runbook, and share findings in engineering syncs.
- Pair with adjacent teams to adopt the shared caching/instrumentation primitives.

## 6. Risks & Mitigations

- **State divergence** – Optimistic UIs may show stale data. Mitigate with refresh queues, stale indicators, and reconciliation on mutation success.
- **Route desynchronization** – Delayed router updates could break deep links.
- **Instrumentation overhead** – Tracing adds cost; sample judiciously and reuse shared helpers.
- **Complex rollout** – Multi-area changes risk regressions; rely on telemetry to catch issues early.
- **Team adoption** – New caching/optimistic patterns demand onboarding; schedule workshops and update docs.

## 7. Dependencies & Collaboration

- Data engineering for Drizzle query adjustments and potential index creation.
- Ops/observability for PostHog pipeline management, dashboards, and alerting.
- Frontend/product design for loading feedback UX alignment.
- QA for manual regression runs aligned to the perceived-speed checklist.
- Stakeholders (PMs) for prioritizing hot spots beyond the Projects Board.

## 8. Rollout Plan & Validation

1. Ship Phase 0 instrumentation to staging/prod; capture baseline dashboards in PostHog.
2. Deploy Phase 1 surface improvements sequentially (board, dashboard, settings), running the manual perceived-speed checklist after each deployment.
3. Roll out Phase 2 caching changes per surface, tracking PostHog event latency and DB load after each release.
4. Validate Phase 3 idle-resume work with manual QA scripts and PostHog visibility-change metrics.
5. Conclude Phase 4 by publishing before/after metrics, archiving dashboards, and updating the performance runbook.

## 9. Open Questions

1. Which additional surfaces (e.g., client settings, activity feed) contribute the most to perceived slowness and should be prioritized after Projects Board?
2. Do we consolidate around React Query for all client-side caching, or are there contexts where server components + cache remain preferable?
3. How aggressively should we prefetch after idle—immediately on focus or deferred until user interaction?
4. What alert thresholds will product/ops consider actionable for interaction latency regressions?
5. Are there dependencies on the full `fetchProjectsWithRelations` payload (analytics, exports) that require alternative endpoints when we slim it down?

[^posthog]: PostHog for Next.js setup guide covering client/server instrumentation, autocapture, and session replay configuration, at https://posthog.com/docs/libraries/nextjs.

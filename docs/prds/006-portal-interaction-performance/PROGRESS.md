# PRD-006 Progress Log

## Session: 2025-11-12

### ✅ Completed

- Installed PostHog client/server SDKs (`posthog-js`, `@posthog/react`, `posthog-node`) and extended environment validation for `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST`.
- Implemented PostHog bootstrap via `instrumentation-client.ts` with session recording enabled and dev-time debug logging.
- Added a global `PostHogProvider` that wraps app providers and introduces a `RouterTransitionTracker` to emit `router.transition` events.
- Created performance helpers (`lib/perf/interaction-marks.ts`) plus client/server PostHog utilities for consistent interaction timing.
- Instrumented Projects board task sheet open/create/close flows with `task_sheet.open` timing metadata.
- Wired dashboard “My Tasks” realtime refreshes to emit `dashboard.refresh` events with success/error outcomes.
- Added client settings sheet instrumentation (client + server) via the shared PostHog helper, covering save/delete/restore/destroy flows.
- Adopted the helper for project saves and soft deletes, plus the full set of hour-block mutations (create/edit/archive/restore/destroy).
- Documented interaction helpers/event constants under `lib/posthog/*` for reuse.

### ⏭️ Next Up

- Finish `settings.save` instrumentation for the remaining project mutations (restore/destroy) and user management flows (create/update/restore/destroy, Supabase admin sync).
- Ensure mutation responses expose identifiers when possible so events can include concrete IDs (e.g., project and hour-block inserts).
- Capture additional board interactions (drag/drop, time log dialogs) and align with PRD Phase 1 requirements.
- Build baseline PostHog dashboards/alerts once events flow through staging.

### 📝 Notes

- Router transitions currently measure completion rather than navigation latency start; follow-up needed to hook into transition start events for better duration fidelity.
- `task_sheet.open` duration reflects time until sheet first renders; we should reconcile with data hydration timing when Phase 1 caching changes land.
- No automated tests updated yet; plan to cover instrumentation utilities with lightweight unit tests after broader adoption.
- Users settings actions still need instrumentation coverage; once patched, revalidate the runbook to confirm the helper is wired everywhere.

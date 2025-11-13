# PRD-006 Baseline Metrics Checklist

Phase 0 requires capturing pre-optimization baselines for the newly instrumented interactions. Use the checklist below before starting Phase 1 work.

## 1. Events to Verify

| Event | Trigger | Notes |
| --- | --- | --- |
| `task_sheet.open` | Task sheet opened (create or edit) | Includes `mode`, `projectId`, `taskId` |
| `board.tab_switch` | Board/backlog/calendar/review tab change | Emits `from`, `to`, `activeTab`, `status` |
| `dashboard.refresh` | “My Tasks” realtime refreshes | `trigger: realtime`, result `updated`/`removed` |
| `idle.resume` | Window refocus or visibility resume | `trigger: focus|visibilitychange`, hidden duration |
| `settings.save` | Clients, projects, hour blocks, users | `entity`, `mode`, `targetId`, duration |

Confirm each event appears in PostHog Live View after a manual interaction in staging.

## 2. Dashboard Template

Create a PostHog dashboard titled **“Portal Interaction Baseline”** with the following tiles:

1. **Task Sheet Open (P95 duration)** – Insight: Trends
   - Series: `task_sheet.open` duration (ms) P95
   - Filter: `mode` in `['create', 'edit']`
2. **Board Tab Switch (P95 duration)** – Trends
   - Series: `board.tab_switch` duration P95
   - Breakdown: `to`
3. **Idle Resume (P95 duration)** – Trends
   - Series: `idle.resume` duration P95
   - Breakdown: `trigger`
4. **Settings Saves (Success vs Error)** – Bar chart
   - Series: count of `settings.save` grouped by `entity`
   - Breakdown: outcome `status`
5. **Dashboard Refresh Result Mix** – Pie chart
   - Series: count of `dashboard.refresh` grouped by `result`

Set the dashboard date range to the last 3 days when capturing baselines.

## 3. Baseline Capture Procedure

1. Deploy the instrumentation to staging.
2. Perform the following scripted interactions twice to seed data:
   - Open a project board, switch tabs (board → calendar → backlog → review).
   - Open/create/edit a task via the sheet.
   - Trigger a dashboard refresh (simulate a task update in another session).
   - Blur the window for ≥5 seconds and refocus; repeat with a hidden tab scenario.
   - Exercise each settings surface (clients, projects, hour blocks, users) with a create + delete.
3. Wait ~5 minutes for events to settle.
4. Export the dashboard as CSV (via the “Export” button) and attach it to the project docs or ticket.
5. Record the P95 durations in the PRD checklist with date + commit hash.

## 4. Alerts (Optional but Recommended)

- Threshold alert on `board.tab_switch` P95 > 200 ms
- Threshold alert on `task_sheet.open` P95 > 200 ms
- Daily digest for `settings.save` errors > 0

Document alert URLs in this file once configured.

---

**Reminder:** re-run this checklist after each major Phase 1/2 milestone to track improvements against the baseline.


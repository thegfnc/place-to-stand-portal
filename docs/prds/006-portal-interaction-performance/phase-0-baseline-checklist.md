# Phase 0 Baseline Checklist

This checklist documents the PostHog assets and manual steps required to capture the initial Phase 0 metrics. Update the tables below once staging data is gathered.

## Dashboards

| Dashboard                   | Location                                             | Notes                                                                                               |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Portal Interaction Baseline | PostHog → Dashboards → `portal-interaction-baseline` | Tracks `board.tab_switch`, `task_sheet.open`, `dashboard.refresh`, and `idle.resume` P95 durations. |
| Settings Mutation Health    | PostHog → Dashboards → `settings-mutation-health`    | Aggregates `settings.save` success/error counts scoped to `entity` + `mode`.                        |

## Alerts

| Alert                    | Query                                 | Threshold                                          |
| ------------------------ | ------------------------------------- | -------------------------------------------------- |
| Board Tab Switch Latency | `board.tab_switch` P95 duration       | Alert at ≥ 200 ms for 15 minutes.                  |
| Idle Resume Latency      | `idle.resume` average hidden duration | Alert at ≥ 500 ms hidden duration over 30 minutes. |

## Manual Baseline Steps

1. Navigate the staging portal and trigger:
   - Each Projects board tab (`board`, `calendar`, `backlog`, `review`, `activity`).
   - Opening/closing a task sheet.
   - Dashboard refresh flows (My Tasks widget).
   - Idle resume by hiding the tab for ~10 seconds, then returning.
2. Verify events stream into PostHog (check Live Events).
3. Capture screenshots (or export CSV) of each dashboard and attach to the project wiki.
4. Record baseline P95 durations in `docs/prds/006-portal-interaction-performance/README.md` under the appropriate metric sections.

## Follow-Up

- Revisit dashboard filters after Phase 1 to compare pre/post numbers.
- Update alert thresholds once production traffic stabilizes.

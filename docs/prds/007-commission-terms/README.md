# PRD 007 — Effective-dated commission terms, optional closer, House (estimated)

**Status:** Implemented September 2026 (branch `claude/damon-closer-removal-impact-813a40`).
**Origin:** PRD 002 future scope, item 3 ("effective-dated commission assignments"), pulled forward
when Damon Bodine was removed as closer while every month since October 2025 was already closed.

## Problem

`clients.closer_user_id`, `origination_user_id` and `origination_contact_id` were live, mutable
columns that the Monthly Close joined directly. Reassigning a closer today rewrote what every
already-closed month recomputed as, which surfaced as permanent drift with no late record. The
same exposure PRD 002 fixed for billing type.

Two further gaps showed up in the same conversation:

- The closer was **required** by the server schema, so the only way to stop paying a closer was
  to pay somebody else 20% instead.
- House on the report is **rate-based** (billing hours × $50), not a residual. Dropping a closer
  therefore made that 20% vanish from the split instead of landing in house, and the buckets no
  longer added up to Billing In. The original test plan for the partner formula described house
  as the residual that absorbs unassigned closer commission; the implementation had diverged.

## Decisions

| # | Decision |
|---|----------|
| D1 | New table `client_commission_terms` copies the `client_billing_terms` shape: one row per (client, month-start `effective_from`), soft-deletable, partial unique index, resolution index. Columns: `closer_user_id`, `origination_user_id`, `origination_contact_id` (mutex CHECK). |
| D2 | Backfill inserts one term per existing client (including archived) at the `2000-01-01` sentinel, copying the live columns, so every historical month resolves to exactly what it rendered before. Verified against the prod snapshot set: zero new drift. |
| D3 | The Monthly Close resolves closer/origination **as of period start** (`closerUserIdAsOfSql` etc. in `lib/queries/clients/commission-terms.ts`), never from `clients.*`. The `clients.*` columns stay as the current-value cache the client list, detail page, and sheet read. |
| D4 | Closer is optional. NULL means the closer share is **not paid**; the report carries it under House. |
| D5 | House is **estimated**, everywhere it is shown: `House (est.)` label, `estimated` total label, caption text, drift label. House = nominal rate × billing hours + closer rate × billing hours whose as-of term has no closer. It is never a payout row. |
| D6 | The client sheet reveals a "New closer / origination starts" boundary select (this month / next month) whenever closer or origination differs from the saved assignment, mirroring the billing-type select. The chosen boundary is guarded against closed months inside the update transaction. |
| D7 | Origination stays required (the referral pipeline is the reason to keep it). |
| D8 | Snapshot schema version stays at 1. New house fields (`nominalAmount`, `unassignedCloserHours`, `unassignedCloserAmount`) are optional on decode and default to zero; every existing snapshot had a closer on every billed client, so the defaults are exact. |

## What changed

- `packages/db/src/schema.ts`, `relations.ts`, migration `0077_client_commission_terms.sql` (table + backfill).
- `apps/internal/lib/queries/clients/commission-terms.ts` (new): insert/upsert helpers, as-of SQL fragments.
- `apps/internal/lib/queries/reports/monthly-close.ts`: the six commission joins match on the as-of fragments.
- `apps/internal/lib/data/reports/{types,monthly-close,close,close-drift}.ts`: house top-up, decoder defaults, drift rows.
- `apps/internal/lib/settings/clients/**`: closer optional, `commissionEffective`, term upsert in create/update, activity detail `commissionEffectiveFrom`.
- Client sheet: boundary select, closer picker copy ("No closer — share stays in house").
- Monthly close UI: `House (est.)` in the distribution card, formula notice, house section (with a "No closer assigned" row), closer section footer row.

## Operating notes

- To stop paying a closer: open the client, clear the closer, pick "Next month" (or "This month" if that month is still open), save. Earlier months keep paying the previous closer.
- A boundary that falls in a closed month is refused; reopen the month first (same rule as billing type).
- Re-closing a month after a commission change re-derives with the as-of terms, so it only changes months whose boundary you actually moved.
- House being "estimated" is not a bug to fix later. Payroll is on a work basis and house on a billing basis; they do not reconcile within one month by design.

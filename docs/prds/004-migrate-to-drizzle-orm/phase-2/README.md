# Phase 2 — RLS Policy Migration & Authorization Layer

- **Owner:** Automation Log
- **Updated:** 2025-11-08
- **Scope:** Captures the application-layer authorization helpers and query scaffolding that replace Supabase RLS for Phase 2.

---

## Outcomes

- Added server-only permission helpers in `lib/auth/permissions.ts` covering:
  - Role checks (`isAdmin`, `assertAdmin`, `assertIsSelf`)
  - Hierarchical access guards (`ensureClientAccess`, `ensureClientAccessByProjectId`, etc.)
  - Utility selectors to enumerate accessible client/project/task IDs for downstream filtering.
- Introduced typed HTTP error helpers in `lib/errors/http.ts` for consistent 401/403/404 responses.
- Scaffolded Drizzle-backed query modules under `lib/queries/`:
  - `clients.ts`, `projects.ts`, `tasks.ts`, and `users.ts` all call into the new permission layer before fetching data.
  - `index.ts` re-exports query helpers so feature modules can transition incrementally.
- Preserved soft-delete semantics by filtering on `deleted_at` and honoring existing admin/member distinctions.

---

## Usage Notes

- All query entry points expect an authenticated `AppUser` (see `lib/auth/session.ts`). They throw `ForbiddenError` or `NotFoundError` when authorization fails.
- `ensureClientAccess*` helpers cascade, allowing higher-level resources (tasks, attachments, time logs) to delegate down to client membership checks.
- Soft-delete operations in `lib/queries/users.ts` now go through Drizzle; future phases should consolidate existing Supabase calls onto these helpers.
- The query modules return raw Drizzle records. Callers can layer on view-model shaping in feature-specific modules.

---

## Next Steps (Phase 3 Preview)

- Replace Supabase data calls across dashboards and settings modules with the new query helpers.
- Expand the query layer with mutations (create/update/delete) once RLS parity is verified.
- Add automated tests that cover the authorization helpers and edge cases around soft-deleted records.


# Phase 4 — Finalization & RLS Decommission

- **Owner:** Automation Log
- **Updated:** 2025-11-10
- **Scope:** Retired the temporary Drizzle verification route, disabled Supabase RLS, and refreshed developer guidance to reflect the Drizzle-first data layer.

---

## Outcomes

- Removed the `app/api/test-drizzle` proof-of-concept route now that Drizzle powers all production data paths.
- Audited Supabase usage and confirmed the SDK is retained exclusively for Auth (SSR/service/browser clients) and Storage operations.
- Added migration `supabase/migrations/20251110123000_disable_rls.sql` to disable row level security across all application tables.
- Documented operational playbooks for running the migration and, if required, applying the SQL manually through Supabase.
- Updated `AGENTS.md` and the technical plan to signal the completed Drizzle migration and RLS decommission.

---

## Migration & Operational Notes

### Automated path (preferred)
1. Ensure `DATABASE_URL` is present (matching the Supabase connection pooler URI) in the environment.
2. Run the Drizzle migration pipeline:
   ```bash
   npx drizzle-kit migrate
   ```
3. Verify the migration history shows `20251110123000_disable_rls.sql` applied.
4. Confirm `SELECT relrowsecurity FROM pg_class WHERE relname = '<table>'` returns `false` for each public table listed below.

### Manual path (fallback via Supabase SQL editor)
If migrations cannot be executed from CI, run the following SQL in Supabase (all statements are idempotent):
```sql
alter table public.activity_logs disable row level security;
alter table public.activity_overview_cache disable row level security;
alter table public.client_members disable row level security;
alter table public.clients disable row level security;
alter table public.hour_blocks disable row level security;
alter table public.projects disable row level security;
alter table public.task_assignees disable row level security;
alter table public.task_attachments disable row level security;
alter table public.task_comments disable row level security;
alter table public.tasks disable row level security;
alter table public.time_log_tasks disable row level security;
alter table public.time_logs disable row level security;
alter table public.users disable row level security;
```

---

## Regression Checklist

- `npm run lint`
- `npm run type-check`
- Manual smoke pass for auth/login, storage uploads, and CRUD flows across settings/projects/tasks/time logs to confirm authorization guards function without database-side RLS.
- Attempt Supabase PostgREST calls as `anon`/`authenticated` (should already be disabled per security plan) to confirm direct data access is blocked.

---

## Follow Up

- Backfill automated authorization regression coverage (see `04-security-hardening-and-verification.md`).
- Monitor logs for elevated `403`/`401` errors over the next release to catch authorization regressions quickly.

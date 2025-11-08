# Phase 3 — Incremental Refactoring (Users & Clients)

- **Owner:** Automation Log
- **Updated:** 2025-11-08
- **Scope:** Migrated the Settings → Users and Settings → Clients surfaces from Supabase queries to the Drizzle data layer while centralizing authorization helpers.

---

## Outcomes

- Replaced all Supabase `from('users' | 'client_members' | 'task_assignees')` usage in the Settings users page and server actions with calls to:
  - `lib/queries/users.ts` (`listUsers`, `getUserById`, `softDeleteUser`, `restoreUser`, membership/task count helpers).
  - Authorization guards in `lib/auth/permissions.ts`, ensuring RBAC parity.
- Server page `app/(dashboard)/settings/users/page.tsx` now fetches user rows and assignment counts via Drizzle, returning data in the legacy table shape for UI compatibility.
- Server actions (`updateUser`, `softDeleteUser`, `restoreUser`, `destroyUser`) now use Drizzle-backed queries for pre/post-change snapshots instead of bespoke Supabase lookups; redundant `user-queries.ts` helper removed.
- Services in `lib/settings/users/services/*` depend on the shared query layer for base operations (lookup, soft delete, restore) while continuing to orchestrate auth metadata and cascading updates.
- Converted Settings → Clients page and server actions to use new Drizzle queries (`getClientsSettingsSnapshot`, slug uniqueness helpers, dependency counters) and guard helpers:
  - `app/(dashboard)/settings/clients/page.tsx` now pulls clients, memberships, and client directory data through `lib/queries/clients.ts`.
  - Client mutations (`save`, `softDelete`, `restore`, `destroy`) operate via Drizzle, leveraging shared membership sync utilities and activity logging without Supabase context objects.
- Migrated Settings → Projects to the Drizzle layer:
  - `app/(dashboard)/settings/projects/page.tsx` reads project and client data via `getProjectsSettingsSnapshot`.
  - Project mutations reuse Drizzle-based slug helpers, dependency counters, and continue logging activity (`save`, `softDelete`, `restore`, `destroy`) without Supabase clients.

---

## Verification Checklist

- `npm run lint`
- `npm run type-check`
- Manual smoke:
- Load `/settings/users` as an admin and ensure active/archived tables populate.
- Soft delete, restore, and permanently delete a non-critical user to confirm activity logs and assignment counts update.
- Update a user’s profile (name, role, avatar, password) and verify change tracking still logs the correct fields.
- Load `/settings/clients` as an admin and confirm client lists, members, and directory data render correctly.
- Create, update (including slug/member changes), archive, restore, and permanently delete a test client to validate activity logging and dependency checks.
- Load `/settings/projects` as an admin to verify project listings and client associations.
- Create a project (with slug), update fields/dates/client, archive, restore, and attempt a destroy when tasks/time logs exist to confirm dependency guards.

---

## Follow Up (Next Domains)

- Port projects- and tasks-related settings/actions to the Drizzle query layer.
- Replace Supabase access in activity feeds once shared query utilities are ready.
- Add Vitest coverage around `lib/auth/permissions.ts` and the users query functions to guard RBAC behavior.
- Backfill automated coverage for client slug/membership utilities and destructive action dependency guards.
- Backfill automated coverage for client slug/membership utilities and destructive action dependency guards.


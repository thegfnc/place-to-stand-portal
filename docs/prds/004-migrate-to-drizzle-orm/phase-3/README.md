# Phase 3 — Incremental Refactoring (Users Domain)

- **Owner:** Automation Log
- **Updated:** 2025-11-08
- **Scope:** Migrated the Settings → Users surface from Supabase queries to the Drizzle data layer and centralized authorization helpers.

---

## Outcomes

- Replaced all Supabase `from('users' | 'client_members' | 'task_assignees')` usage in the Settings users page and server actions with calls to:
  - `lib/queries/users.ts` (`listUsers`, `getUserById`, `softDeleteUser`, `restoreUser`, membership/task count helpers).
  - Authorization guards in `lib/auth/permissions.ts`, ensuring RBAC parity.
- Server page `app/(dashboard)/settings/users/page.tsx` now fetches user rows and assignment counts via Drizzle, returning data in the legacy table shape for UI compatibility.
- Server actions (`updateUser`, `softDeleteUser`, `restoreUser`, `destroyUser`) now use Drizzle-backed queries for pre/post-change snapshots instead of bespoke Supabase lookups; redundant `user-queries.ts` helper removed.
- Services in `lib/settings/users/services/*` depend on the shared query layer for base operations (lookup, soft delete, restore) while continuing to orchestrate auth metadata and cascading updates.

---

## Verification Checklist

- `npm run lint`
- `npm run type-check`
- Manual smoke:
  - Load `/settings/users` as an admin and ensure active/archived tables populate.
  - Soft delete, restore, and permanently delete a non-critical user to confirm activity logs and assignment counts update.
  - Update a user’s profile (name, role, avatar, password) and verify change tracking still logs the correct fields.

---

## Follow Up (Next Domains)

- Port projects- and tasks-related settings/actions to the Drizzle query layer.
- Replace Supabase access in activity feeds once shared query utilities are ready.
- Add Vitest coverage around `lib/auth/permissions.ts` and the users query functions to guard RBAC behavior.


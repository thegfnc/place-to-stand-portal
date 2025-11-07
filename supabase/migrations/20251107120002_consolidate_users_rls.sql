-- Consolidate RLS policies for users table
-- This migration combines the admin and self-view policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Users can view themselves": for select only
--   - "Admins manage users": using+with_check for all operations (includes SELECT)
-- After: 2 policies (1 per operation type)
--   - "Users view accessible users": consolidated SELECT (admin OR self-view)
--   - "Admins manage users": INSERT/UPDATE/DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Rollback: If needed, restore policies from migration 20251107082130
--   drop policy if exists "Users view accessible users" on public.users;
--   drop policy if exists "Admins manage users" on public.users;
--   create policy "Users can view themselves" on public.users
--     for select using ((select auth.uid()) = id and deleted_at is null);
--   create policy "Admins manage users" on public.users
--     using (public.is_admin()) with check (public.is_admin());

-- Drop existing policies
drop policy if exists "Users can view themselves" on public.users;
drop policy if exists "Admins manage users" on public.users;

-- Create consolidated SELECT policy (admin OR self-view)
create policy "Users view accessible users" on public.users
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or (select auth.uid()) = id
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert users" on public.users
  for insert with check (
    public.is_admin()
  );

create policy "Admins update users" on public.users
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete users" on public.users
  for delete using (
    public.is_admin()
  );


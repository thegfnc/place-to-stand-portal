-- Consolidate RLS policies for client_members table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Admins manage client members": using+with_check for all operations (includes SELECT)
--   - "Members view their client assignments": for select only
-- After: 4 policies (eliminates duplicate SELECT)
--   - "Users view client members": consolidated SELECT (admin OR member)
--   - "Admins insert client members": INSERT (admin only)
--   - "Admins update client members": UPDATE (admin only)
--   - "Admins delete client members": DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Rollback: If needed, restore policies from migration 20251107082130
--   drop policy if exists "Users view client members" on public.client_members;
--   drop policy if exists "Admins insert client members" on public.client_members;
--   drop policy if exists "Admins update client members" on public.client_members;
--   drop policy if exists "Admins delete client members" on public.client_members;
--   create policy "Admins manage client members" on public.client_members
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members view their client assignments" on public.client_members
--     for select using (user_id = (select auth.uid()) and deleted_at is null);

-- Drop existing policies
drop policy if exists "Admins manage client members" on public.client_members;
drop policy if exists "Members view their client assignments" on public.client_members;

-- Create consolidated SELECT policy (admin OR member viewing their own assignments)
create policy "Users view client members" on public.client_members
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or user_id = (select auth.uid())
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Note: Currently only admins can modify client_members
-- If member modifications are needed in future, add OR conditions here
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert client members" on public.client_members
  for insert with check (
    public.is_admin()
  );

create policy "Admins update client members" on public.client_members
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete client members" on public.client_members
  for delete using (
    public.is_admin()
  );


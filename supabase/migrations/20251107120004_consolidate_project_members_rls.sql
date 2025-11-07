-- Consolidate RLS policies for project_members table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Admins manage project members": using+with_check for all operations (includes SELECT)
--   - "Members view project members": for select only
-- After: 2 policies (1 per operation type)
--   - "Users view project members": consolidated SELECT (admin OR project member)
--   - "Admins manage project members": INSERT/UPDATE/DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Note: Uses helper function user_is_project_member from migration 20251025153000
--
-- Rollback: If needed, restore policies from migration 20251025153000
--   drop policy if exists "Users view project members" on public.project_members;
--   drop policy if exists "Admins manage project members" on public.project_members;
--   create policy "Admins manage project members" on public.project_members
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members view project members" on public.project_members
--     for select using (
--       deleted_at is null
--       and public.user_is_project_member(project_members.project_id)
--     );

-- Drop existing policies
drop policy if exists "Admins manage project members" on public.project_members;
drop policy if exists "Members view project members" on public.project_members;

-- Create consolidated SELECT policy (admin OR project member)
create policy "Users view project members" on public.project_members
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_project_member(project_members.project_id)
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert project members" on public.project_members
  for insert with check (
    public.is_admin()
  );

create policy "Admins update project members" on public.project_members
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete project members" on public.project_members
  for delete using (
    public.is_admin()
  );


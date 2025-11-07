-- Consolidate RLS policies for projects table
-- This migration combines the admin and member policies for SELECT and UPDATE operations
-- into single policies to improve query performance.
--
-- Before: 3 policies
--   - "Admins full access to projects": using+with_check for all operations (includes SELECT, UPDATE)
--   - "Members read projects": for select only
--   - "Members update their projects": for update only
-- After: 5 policies (eliminates duplicate SELECT and UPDATE)
--   - "Users view projects": consolidated SELECT (admin OR member with helper functions)
--   - "Users create projects": INSERT (admin only for now)
--   - "Users update projects": consolidated UPDATE (admin OR project member with edit permission)
--   - "Admins delete projects": DELETE (admin only)
--
-- This eliminates the duplicate SELECT and UPDATE policies while maintaining the same access controls.
--
-- Note: Uses helper functions user_is_project_member, user_is_client_member, and user_can_edit_project
-- from migration 20251025153000
--
-- Rollback: If needed, restore policies from migration 20251025153000
--   drop policy if exists "Users view projects" on public.projects;
--   drop policy if exists "Users create projects" on public.projects;
--   drop policy if exists "Users update projects" on public.projects;
--   drop policy if exists "Admins delete projects" on public.projects;
--   create policy "Admins full access to projects" on public.projects
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members read projects" on public.projects
--     for select using (
--       deleted_at is null
--       and (
--         public.user_is_project_member(projects.id)
--         or public.user_is_client_member(projects.client_id)
--       )
--     );
--   create policy "Members update their projects" on public.projects
--     for update using (
--       public.is_admin() or public.user_can_edit_project(projects.id)
--     )
--     with check (
--       public.is_admin() or public.user_can_edit_project(projects.id)
--     );

-- Drop existing policies
drop policy if exists "Admins full access to projects" on public.projects;
drop policy if exists "Members read projects" on public.projects;
drop policy if exists "Members update their projects" on public.projects;

-- Create consolidated SELECT policy (admin OR project/client member)
create policy "Users view projects" on public.projects
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_project_member(projects.id)
      or public.user_is_client_member(projects.client_id)
    )
  );

-- Create INSERT policy (admin only for now)
-- Note: Currently only admins can create projects
-- If member creation is needed in future, add OR conditions here
create policy "Users create projects" on public.projects
  for insert with check (
    public.is_admin()
  );

-- Create consolidated UPDATE policy (admin OR project member with edit permission)
create policy "Users update projects" on public.projects
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_can_edit_project(projects.id)
    )
  ) with check (
    public.is_admin()
    or public.user_can_edit_project(projects.id)
  );

-- Create DELETE policy (admin only)
create policy "Admins delete projects" on public.projects
  for delete using (
    public.is_admin()
  );


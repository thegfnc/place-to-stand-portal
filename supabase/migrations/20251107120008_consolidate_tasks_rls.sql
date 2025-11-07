-- Consolidate RLS policies for tasks table
-- This migration combines the admin and project member policies for all operations
-- into single policies per operation to improve query performance.
--
-- Before: 2 policies
--   - "Admins full access to tasks": using+with_check for all operations (includes SELECT, INSERT, UPDATE, DELETE)
--   - "Project members manage tasks": using+with_check for all operations (includes SELECT, INSERT, UPDATE, DELETE)
-- After: 4 policies (eliminates duplicates for all operations)
--   - "Users view tasks": consolidated SELECT (admin OR project member)
--   - "Users create tasks": consolidated INSERT (admin OR project member with edit permission)
--   - "Users update tasks": consolidated UPDATE (admin OR project member with edit permission)
--   - "Users delete tasks": consolidated DELETE (admin OR project member with edit permission)
--
-- This eliminates duplicate policies for all operations while maintaining the same access controls.
--
-- Note: Uses helper functions user_is_project_member and user_can_edit_project from migration 20251025153000
--
-- Rollback: If needed, restore policies from migration 20251025153000
--   drop policy if exists "Users view tasks" on public.tasks;
--   drop policy if exists "Users create tasks" on public.tasks;
--   drop policy if exists "Users update tasks" on public.tasks;
--   drop policy if exists "Users delete tasks" on public.tasks;
--   create policy "Admins full access to tasks" on public.tasks
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Project members manage tasks" on public.tasks
--     using (
--       deleted_at is null
--       and public.user_is_project_member(tasks.project_id)
--     )
--     with check (
--       public.user_can_edit_project(tasks.project_id)
--     );

-- Drop existing policies
drop policy if exists "Admins full access to tasks" on public.tasks;
drop policy if exists "Project members manage tasks" on public.tasks;

-- Create consolidated SELECT policy (admin OR project member)
create policy "Users view tasks" on public.tasks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_project_member(tasks.project_id)
    )
  );

-- Create consolidated INSERT policy (admin OR project member with edit permission)
create policy "Users create tasks" on public.tasks
  for insert with check (
    public.is_admin()
    or public.user_can_edit_project(tasks.project_id)
  );

-- Create consolidated UPDATE policy (admin OR project member with edit permission)
create policy "Users update tasks" on public.tasks
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_can_edit_project(tasks.project_id)
    )
  ) with check (
    public.is_admin()
    or public.user_can_edit_project(tasks.project_id)
  );

-- Create consolidated DELETE policy (admin OR project member with edit permission)
create policy "Users delete tasks" on public.tasks
  for delete using (
    public.is_admin()
    or public.user_can_edit_project(tasks.project_id)
  );


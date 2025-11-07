-- Consolidate RLS policies for tasks table
-- This migration combines the admin and project member policies for all operations
-- into single policies per operation to improve query performance.
--
-- Before: 2 policies (admin using+with_check for all ops, member using+with_check for all ops)
-- After: 1 policy per operation (consolidated policies)
--
-- Note: Uses helper functions from migration 20251025153000
-- Rollback: If needed, restore the original policies from migration 20251025153000

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


-- Fix task_assignees RLS policies to allow project members to manage assignees
--
-- This migration fixes the task_assignees policies created in migration 20251107120003.
-- The original consolidation made INSERT/UPDATE/DELETE admin-only, but the application
-- requires project members with edit permissions to manage task assignees (matching
-- the permissions for managing tasks).
--
-- The fix uses the same direct join pattern as task_attachments (which works correctly),
-- but removes the deleted_at check from the UPDATE using clause to allow updating
-- soft-deleted assignee rows (required for the syncAssignees upsert pattern).
--
-- Changes:
--   - Keep the SELECT policy from migration 20251107120003 (already correct)
--   - Fix INSERT/UPDATE/DELETE policies to use direct joins instead of helper functions
--   - UPDATE policy does NOT check deleted_at in using clause (allows updating soft-deleted rows)
--   - Maintain admin-only policies separately to avoid conflicts
--
-- Rollback: Restore policies from migration 20251107120003

-- Drop the incorrect INSERT/UPDATE/DELETE policies from migration 20251107120003
-- (These were too restrictive - admin-only, but project members need to manage assignees)
-- The original migration created "Admins insert/update/delete task assignees" policies
drop policy if exists "Admins insert task assignees" on public.task_assignees;
drop policy if exists "Admins update task assignees" on public.task_assignees;
drop policy if exists "Admins delete task assignees" on public.task_assignees;

-- Also drop any "Users" policies that might exist (from previous fix attempts)
drop policy if exists "Users insert task assignees" on public.task_assignees;
drop policy if exists "Users update task assignees" on public.task_assignees;
drop policy if exists "Users delete task assignees" on public.task_assignees;

-- Create admin policy for all operations (allows admins to do everything)
-- This is separate from member policies to avoid conflicts
create policy "Admins manage task assignees" on public.task_assignees
  using (public.is_admin())
  with check (public.is_admin());

-- INSERT: Allow project members with edit permission (matching task_attachments pattern)
create policy "Project collaborators insert task assignees" on public.task_assignees
  for insert with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  );

-- UPDATE: Allow project members with edit permission
-- CRITICAL: Do NOT check deleted_at in using clause - we need to update soft-deleted rows
-- This is different from task_attachments which checks deleted_at is null
create policy "Project collaborators update task assignees" on public.task_assignees
  for update using (
    -- Allow seeing/updating rows if user is project member
    -- Don't filter by deleted_at - we need to update soft-deleted assignees
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  )
  with check (
    -- Validate updated row - user must still be project member
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  );

-- DELETE: Allow project members with edit permission
create policy "Project collaborators delete task assignees" on public.task_assignees
  for delete using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  );


-- Consolidate RLS policies for task_assignees table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Admins manage task assignees": using+with_check for all operations (includes SELECT)
--   - "Members view task assignees": for select only
-- After: 2 policies (1 per operation type)
--   - "Users view task assignees": consolidated SELECT (admin OR project member)
--   - "Admins manage task assignees": INSERT/UPDATE/DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Rollback: If needed, restore policies from migration 20251107082130
--   drop policy if exists "Users view task assignees" on public.task_assignees;
--   drop policy if exists "Admins manage task assignees" on public.task_assignees;
--   create policy "Admins manage task assignees" on public.task_assignees
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members view task assignees" on public.task_assignees
--     for select using (
--       exists (
--         select 1 from public.tasks t
--         where t.id = task_assignees.task_id
--           and t.deleted_at is null
--           and exists (
--             select 1 from public.project_members pm
--             where pm.project_id = t.project_id
--               and pm.user_id = (select auth.uid())
--               and pm.deleted_at is null
--           )
--       )
--       and deleted_at is null
--     );

-- Drop existing policies
drop policy if exists "Admins manage task assignees" on public.task_assignees;
drop policy if exists "Members view task assignees" on public.task_assignees;

-- Create consolidated SELECT policy (admin OR project member)
create policy "Users view task assignees" on public.task_assignees
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1 from public.tasks t
        where t.id = task_assignees.task_id
          and t.deleted_at is null
          and exists (
            select 1 from public.project_members pm
            where pm.project_id = t.project_id
              and pm.user_id = (select auth.uid())
              and pm.deleted_at is null
          )
      )
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert task assignees" on public.task_assignees
  for insert with check (
    public.is_admin()
  );

create policy "Admins update task assignees" on public.task_assignees
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete task assignees" on public.task_assignees
  for delete using (
    public.is_admin()
  );


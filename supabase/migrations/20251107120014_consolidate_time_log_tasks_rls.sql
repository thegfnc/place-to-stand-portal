-- Consolidate RLS policies for time_log_tasks table
-- This migration combines the admin, author, and project member policies for all operations
-- into single policies per operation to improve query performance.
--
-- Before:
--   - "Admins manage time log tasks" (all ops with using+with_check)
--   - "Authors manage their time log tasks" (all ops with using+with_check)
--   - "Project collaborators read time log tasks" (SELECT)
-- After:
--   - "Users view time log tasks" (SELECT - consolidated)
--   - "Users create time log tasks" (INSERT - consolidated)
--   - "Users update time log tasks" (UPDATE - consolidated)
--   - "Users delete time log tasks" (DELETE - consolidated)
--
-- Pattern: Uses direct joins
-- Note: Authors can manage their own time log tasks (via time_log ownership)
--       Project members can read time log tasks
-- Rollback: Restore policies from migrations 20251027121500 and 20251107082130

-- Drop existing policies
drop policy if exists "Admins manage time log tasks" on public.time_log_tasks;
drop policy if exists "Authors manage their time log tasks" on public.time_log_tasks;
drop policy if exists "Project collaborators read time log tasks" on public.time_log_tasks;

-- Create admin policy for all operations (allows admins to do everything)
-- This is separate from member policies to avoid conflicts
create policy "Admins manage time log tasks" on public.time_log_tasks
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Consolidate admin OR author OR project/client member read access
create policy "Users view time log tasks" on public.time_log_tasks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.time_logs tl
        where tl.id = time_log_tasks.time_log_id
          and tl.user_id = (select auth.uid())
          and tl.deleted_at is null
      )
      or exists (
        select 1
        from public.time_logs tl
        join public.projects p on p.id = tl.project_id and p.deleted_at is null
        left join public.project_members pm
          on pm.project_id = p.id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        left join public.client_members cm
          on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where tl.id = time_log_tasks.time_log_id
          and tl.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- INSERT: Consolidate admin OR author create access (authors manage their own time log tasks)
create policy "Users create time log tasks" on public.time_log_tasks
  for insert with check (
    public.is_admin()
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  );

-- UPDATE: Consolidate admin OR author update access (authors manage their own time log tasks)
-- Note: Does NOT check deleted_at in using clause to match original behavior
-- (original "Authors manage their time log tasks" policy didn't filter by deleted_at)
create policy "Users update time log tasks" on public.time_log_tasks
  for update using (
    public.is_admin()
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  );

-- DELETE: Consolidate admin OR author delete access (authors manage their own time log tasks)
create policy "Users delete time log tasks" on public.time_log_tasks
  for delete using (
    public.is_admin()
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  );


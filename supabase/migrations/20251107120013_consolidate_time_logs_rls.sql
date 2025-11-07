-- Consolidate RLS policies for time_logs table
-- This migration combines the admin and project member policies for SELECT, INSERT, and UPDATE
-- into single policies per operation to improve query performance.
--
-- Before:
--   - "Admins manage time logs" (all ops with using+with_check)
--   - "Project collaborators read time logs" (SELECT)
--   - "Admins log time on assigned projects" (INSERT)
--   - "Authors update their time logs" (UPDATE)
-- After:
--   - "Users view time logs" (SELECT - consolidated)
--   - "Users create time logs" (INSERT - consolidated)
--   - "Users update time logs" (UPDATE - consolidated)
--
-- Pattern: Uses direct joins
-- Note: INSERT is admin-only (was contractor-only, now admin-only after role removal)
--       UPDATE allows authors to update their own logs
-- Rollback: Restore policies from migrations 20251027004441, 20251106105906, and 20251107082130

-- Drop existing policies
drop policy if exists "Admins manage time logs" on public.time_logs;
drop policy if exists "Project collaborators read time logs" on public.time_logs;
drop policy if exists "Admins log time on assigned projects" on public.time_logs;
drop policy if exists "Authors update their time logs" on public.time_logs;

-- Create admin policy for all operations (allows admins to do everything)
-- This is separate from member policies to avoid conflicts
create policy "Admins manage time logs" on public.time_logs
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Consolidate admin OR project/client member read access
create policy "Users view time logs" on public.time_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.projects p
        left join public.project_members pm
          on pm.project_id = p.id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        left join public.client_members cm
          on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where p.id = time_logs.project_id
          and p.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- INSERT: Consolidate admin-only (admins who are project members can log time)
-- Note: This was contractor-only before, now admin-only after role removal
create policy "Users create time logs" on public.time_logs
  for insert with check (
    user_id = (select auth.uid())
    and public.is_admin()
    and exists (
      select 1
      from public.projects p
      left join public.project_members pm
        on pm.project_id = p.id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where p.id = time_logs.project_id
        and p.deleted_at is null
        and pm.id is not null
    )
  );

-- UPDATE: Consolidate admin OR author update access (authors update their own logs)
-- Note: Checks deleted_at in using clause (authors update active logs only)
create policy "Users update time logs" on public.time_logs
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or (
        user_id = (select auth.uid())
        and exists (
          select 1
          from public.projects p
          left join public.project_members pm
            on pm.project_id = p.id
            and pm.user_id = (select auth.uid())
            and pm.deleted_at is null
          where p.id = time_logs.project_id
            and p.deleted_at is null
            and pm.id is not null
        )
      )
    )
  ) with check (
    public.is_admin()
    or (
      user_id = (select auth.uid())
      and exists (
        select 1
        from public.projects p
        left join public.project_members pm
          on pm.project_id = p.id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        where p.id = time_logs.project_id
          and p.deleted_at is null
          and pm.id is not null
      )
    )
  );


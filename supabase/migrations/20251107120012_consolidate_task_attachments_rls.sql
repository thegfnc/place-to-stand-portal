-- Consolidate RLS policies for task_attachments table
-- This migration combines the admin and project member policies for SELECT, INSERT, and UPDATE
-- into single policies per operation to improve query performance.
--
-- Before:
--   - "Admins manage task attachments" (all ops with using+with_check)
--   - "Project collaborators read task attachments" (SELECT)
--   - "Project collaborators create task attachments" (INSERT)
--   - "Project managers update task attachments" (UPDATE)
-- After:
--   - "Users view task attachments" (SELECT - consolidated)
--   - "Users create task attachments" (INSERT - consolidated)
--   - "Users update task attachments" (UPDATE - consolidated)
--
-- Pattern: Uses direct joins (like task_assignees fix)
-- Note: UPDATE policy checks deleted_at in using clause (like task_attachments currently does, unlike task_assignees)
-- Rollback: Restore policies from migrations 20251027140000 and 20251106104758 and 20251107082130

-- Drop existing policies
drop policy if exists "Admins manage task attachments" on public.task_attachments;
drop policy if exists "Project collaborators read task attachments" on public.task_attachments;
drop policy if exists "Project collaborators create task attachments" on public.task_attachments;
drop policy if exists "Project managers update task attachments" on public.task_attachments;

-- Create admin policy for all operations (allows admins to do everything)
-- This is separate from member policies to avoid conflicts
create policy "Admins manage task attachments" on public.task_attachments
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Consolidate admin OR project/client member read access
create policy "Users view task attachments" on public.task_attachments
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        left join public.project_members pm
          on pm.project_id = t.project_id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        left join public.client_members cm
          on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- INSERT: Consolidate admin OR project/client member create access (must be uploader)
create policy "Users create task attachments" on public.task_attachments
  for insert with check (
    (select auth.uid()) = uploaded_by
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        left join public.project_members pm
          on pm.project_id = t.project_id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        left join public.client_members cm
          on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- UPDATE: Consolidate admin OR project member update access
-- Note: Checks deleted_at in using clause (project members update active attachments only)
create policy "Users update task attachments" on public.task_attachments
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        join public.project_members pm
          on pm.project_id = t.project_id
          and pm.user_id = (select auth.uid())
          and pm.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
      )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_attachments.task_id
        and t.deleted_at is null
    )
  );


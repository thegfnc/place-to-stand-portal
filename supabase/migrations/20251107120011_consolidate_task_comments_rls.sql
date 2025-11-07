-- Consolidate RLS policies for task_comments table
-- This migration combines the admin and project member policies for SELECT, INSERT, and UPDATE
-- into single policies per operation to improve query performance.
--
-- Before:
--   - "Admins manage task comments" (all ops with using+with_check)
--   - "Project collaborators read task comments" (SELECT)
--   - "Project collaborators create task comments" (INSERT)
--   - "Authors update their task comments" (UPDATE)
-- After:
--   - "Users view task comments" (SELECT - consolidated)
--   - "Users create task comments" (INSERT - consolidated)
--   - "Users update task comments" (UPDATE - consolidated)
--
-- Pattern: Uses direct joins (like task_assignees fix) instead of helper functions
-- Note: UPDATE policy checks deleted_at in using clause (authors update their own comments, no soft-delete pattern like assignees)
-- Rollback: Restore policies from migration 20251027004336

-- Drop existing policies
drop policy if exists "Admins manage task comments" on public.task_comments;
drop policy if exists "Project collaborators read task comments" on public.task_comments;
drop policy if exists "Project collaborators create task comments" on public.task_comments;
drop policy if exists "Authors update their task comments" on public.task_comments;

-- Create admin policy for all operations (allows admins to do everything)
-- This is separate from member policies to avoid conflicts
create policy "Admins manage task comments" on public.task_comments
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Consolidate admin OR project/client member read access
create policy "Users view task comments" on public.task_comments
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
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- INSERT: Consolidate admin OR project/client member create access (must be author)
create policy "Users create task comments" on public.task_comments
  for insert with check (
    author_id = (select auth.uid())
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
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );

-- UPDATE: Consolidate admin OR author update access (authors update their own comments)
-- Note: Checks deleted_at in using clause - authors update active comments only
create policy "Users update task comments" on public.task_comments
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or (
        author_id = (select auth.uid())
        and exists (
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
          where t.id = task_comments.task_id
            and t.deleted_at is null
            and (
              pm.id is not null
              or cm.id is not null
            )
        )
      )
    )
  ) with check (
    public.is_admin()
    or (
      author_id = (select auth.uid())
      and exists (
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
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and (
            pm.id is not null
            or cm.id is not null
          )
      )
    )
  );


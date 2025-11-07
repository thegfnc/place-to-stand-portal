-- Remove project_members table and update all references to use client_members instead
-- This migration:
-- 1. Updates helper functions to check client_members instead of project_members
-- 2. Updates all RLS policies to remove project_members references
-- 3. Drops all policies on project_members table
-- 4. Drops the project_members table

-- Update helper function: user_is_project_member
-- Now checks if user is a member of the project's client
create or replace function public.user_is_project_member(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id uuid;
begin
  if v_user_id is null then
    return false;
  end if;

  -- Get the project's client_id
  select client_id into v_client_id
  from public.projects
  where id = p_project_id
    and deleted_at is null;

  if v_client_id is null then
    return false;
  end if;

  -- Check if user is a member of the project's client
  return exists (
    select 1
    from public.client_members cm
    where cm.client_id = v_client_id
      and cm.user_id = v_user_id
      and cm.deleted_at is null
  );
end;
$$;

-- Update helper function: user_can_edit_project
-- Now checks if user is a member of the project's client (or is admin)
create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id uuid;
begin
  if v_user_id is null then
    return false;
  end if;

  -- Get the project's client_id
  select client_id into v_client_id
  from public.projects
  where id = p_project_id
    and deleted_at is null;

  if v_client_id is null then
    return false;
  end if;

  -- Check if user is a member of the project's client
  return exists (
    select 1
    from public.client_members cm
    where cm.client_id = v_client_id
      and cm.user_id = v_user_id
      and cm.deleted_at is null
  );
end;
$$;

-- Update activity_logs policies to remove project_members references
drop policy if exists "Users view activity logs" on public.activity_logs;
drop policy if exists "Users insert activity logs" on public.activity_logs;
drop policy if exists "Admins update activity logs" on public.activity_logs;
drop policy if exists "Admins delete activity logs" on public.activity_logs;

-- SELECT: Allow admin OR user viewing own/accessible logs
create policy "Users view activity logs" on public.activity_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or (
        target_project_id is not null
        and public.user_is_project_member(target_project_id)
      )
      or (
        target_client_id is not null
        and exists (
          select 1
          from public.client_members cm
          where cm.client_id = target_client_id
            and cm.user_id = (select auth.uid())
            and cm.deleted_at is null
        )
      )
    )
  );

-- INSERT: Allow admin OR user inserting own logs
create policy "Users insert activity logs" on public.activity_logs
  for insert with check (
    public.is_admin()
    or actor_id = (select auth.uid())
  );

-- UPDATE: Allow admin only (for restore/archive operations)
create policy "Admins update activity logs" on public.activity_logs
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

-- DELETE: Allow admin only
create policy "Admins delete activity logs" on public.activity_logs
  for delete using (
    public.is_admin()
  );

-- Update task_assignees policies to remove project_members references
drop policy if exists "Users view task assignees" on public.task_assignees;
drop policy if exists "Project collaborators insert task assignees" on public.task_assignees;
drop policy if exists "Project collaborators update task assignees" on public.task_assignees;
drop policy if exists "Project collaborators delete task assignees" on public.task_assignees;
drop policy if exists "Admins manage task assignees" on public.task_assignees;

-- Create admin policy for all operations
create policy "Admins manage task assignees" on public.task_assignees
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Allow admin OR project member (via helper function)
create policy "Users view task assignees" on public.task_assignees
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1 from public.tasks t
        where t.id = task_assignees.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

-- INSERT: Allow project members with edit permission
create policy "Project collaborators insert task assignees" on public.task_assignees
  for insert with check (
    (select auth.uid()) is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_assignees.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

-- UPDATE: Allow project members with edit permission
-- Note: Do NOT check deleted_at in using clause - we need to update soft-deleted rows
create policy "Project collaborators update task assignees" on public.task_assignees
  for update using (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_is_project_member(t.project_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_is_project_member(t.project_id)
    )
  );

-- DELETE: Allow project members with edit permission
create policy "Project collaborators delete task assignees" on public.task_assignees
  for delete using (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_is_project_member(t.project_id)
    )
  );

-- Update task_comments policies to remove project_members references
drop policy if exists "Users view task comments" on public.task_comments;
create policy "Users view task comments" on public.task_comments
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

drop policy if exists "Users create task comments" on public.task_comments;
create policy "Users create task comments" on public.task_comments
  for insert with check (
    author_id = (select auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

drop policy if exists "Users update task comments" on public.task_comments;
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
          where t.id = task_comments.task_id
            and t.deleted_at is null
            and public.user_is_project_member(t.project_id)
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
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

-- Update task_attachments policies to remove project_members references
drop policy if exists "Users view task attachments" on public.task_attachments;
create policy "Users view task attachments" on public.task_attachments
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

drop policy if exists "Users create task attachments" on public.task_attachments;
create policy "Users create task attachments" on public.task_attachments
  for insert with check (
    (select auth.uid()) = uploaded_by
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  );

drop policy if exists "Users update task attachments" on public.task_attachments;
create policy "Users update task attachments" on public.task_attachments
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and public.user_is_project_member(t.project_id)
      )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_attachments.task_id
        and t.deleted_at is null
        and public.user_is_project_member(t.project_id)
    )
  );

-- Update time_logs policies to remove project_members references
drop policy if exists "Users view time logs" on public.time_logs;
create policy "Users view time logs" on public.time_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_project_member(time_logs.project_id)
    )
  );

drop policy if exists "Users create time logs" on public.time_logs;
create policy "Users create time logs" on public.time_logs
  for insert with check (
    user_id = (select auth.uid())
    and public.is_admin()
    and public.user_is_project_member(time_logs.project_id)
  );

drop policy if exists "Users update time logs" on public.time_logs;
create policy "Users update time logs" on public.time_logs
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      or (
        user_id = (select auth.uid())
        and public.user_is_project_member(time_logs.project_id)
      )
    )
  ) with check (
    public.is_admin()
    or (
      user_id = (select auth.uid())
      and public.user_is_project_member(time_logs.project_id)
    )
  );

-- Update time_log_tasks policies to remove project_members references
drop policy if exists "Users view time log tasks" on public.time_log_tasks;
drop policy if exists "Users create time log tasks" on public.time_log_tasks;
drop policy if exists "Users update time log tasks" on public.time_log_tasks;
drop policy if exists "Users delete time log tasks" on public.time_log_tasks;
drop policy if exists "Admins manage time log tasks" on public.time_log_tasks;

-- Create admin policy for all operations
create policy "Admins manage time log tasks" on public.time_log_tasks
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Allow admin OR author OR project member read access
create policy "Users view time log tasks" on public.time_log_tasks
  for select using (
    time_log_tasks.deleted_at is null
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
        where tl.id = time_log_tasks.time_log_id
          and tl.deleted_at is null
          and public.user_is_project_member(tl.project_id)
      )
    )
  );

-- INSERT: Allow admin OR author create access
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

-- UPDATE: Allow admin OR author update access
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

-- DELETE: Allow admin OR author delete access
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

-- Drop all policies on project_members table
drop policy if exists "Users view project members" on public.project_members;
drop policy if exists "Admins insert project members" on public.project_members;
drop policy if exists "Admins update project members" on public.project_members;
drop policy if exists "Admins delete project members" on public.project_members;
drop policy if exists "Admins manage project members" on public.project_members;
drop policy if exists "Members view project members" on public.project_members;

-- Drop the project_members table
-- Note: This will cascade delete due to foreign key constraints
drop table if exists public.project_members;


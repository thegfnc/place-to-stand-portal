-- Remove user_is_project_member function and replace all usages
-- Since project members no longer exist, admins should be able to edit every project
-- Client members can still view projects they have access to via client membership
--
-- Changes:
-- 1. Replace user_is_project_member calls with is_admin() OR user_is_client_member(project.client_id) for viewing
-- 2. Replace user_can_edit_project calls with is_admin() for editing
-- 3. Update user_can_edit_project function to only check is_admin()
-- 4. Drop user_is_project_member function

-- Update user_can_edit_project function to only check admin status
-- Admins should be able to edit every project
create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return public.is_admin();
end;
$$;

-- Update projects policies
-- Note: These policies were created in 20251107120007_consolidate_projects_rls.sql
-- and still reference user_is_project_member
drop policy if exists "Users view projects" on public.projects;
drop policy if exists "Members read projects" on public.projects;
drop policy if exists "Admins full access to projects" on public.projects;
create policy "Users view projects" on public.projects
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_client_member(projects.client_id)
    )
  );

drop policy if exists "Users update projects" on public.projects;
drop policy if exists "Members update their projects" on public.projects;
create policy "Users update projects" on public.projects
  for update using (
    deleted_at is null
    and public.is_admin()
  ) with check (
    public.is_admin()
  );

-- Update tasks policies
-- Note: These policies were created in 20251107120008_consolidate_tasks_rls.sql
-- and still reference user_is_project_member and user_can_edit_project
drop policy if exists "Users view tasks" on public.tasks;
drop policy if exists "Project members manage tasks" on public.tasks;
drop policy if exists "Admins full access to tasks" on public.tasks;
create policy "Users view tasks" on public.tasks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.projects p
        where p.id = tasks.project_id
          and p.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

drop policy if exists "Users create tasks" on public.tasks;
create policy "Users create tasks" on public.tasks
  for insert with check (
    public.is_admin()
  );

drop policy if exists "Users update tasks" on public.tasks;
create policy "Users update tasks" on public.tasks
  for update using (
    deleted_at is null
    and public.is_admin()
  ) with check (
    public.is_admin()
  );

drop policy if exists "Users delete tasks" on public.tasks;
create policy "Users delete tasks" on public.tasks
  for delete using (
    public.is_admin()
  );

-- Update clients policies
-- Note: These policies were created in 20251107120006_consolidate_clients_rls.sql
-- and still reference user_is_project_member
drop policy if exists "Users view clients" on public.clients;
drop policy if exists "Members read clients" on public.clients;
drop policy if exists "Admins full access to clients" on public.clients;
create policy "Users view clients" on public.clients
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_client_member(clients.id)
    )
  );

-- Update hour_blocks policies
-- Note: These policies were created in 20251107120005_consolidate_hour_blocks_rls.sql
-- and still reference user_is_project_member
drop policy if exists "Users view hour blocks" on public.hour_blocks;
drop policy if exists "Members view hour blocks" on public.hour_blocks;
drop policy if exists "Admins manage hour blocks" on public.hour_blocks;
create policy "Users view hour blocks" on public.hour_blocks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_client_member(hour_blocks.client_id)
    )
  );

-- Update activity_logs policies
drop policy if exists "Users view activity logs" on public.activity_logs;
create policy "Users view activity logs" on public.activity_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or (
        target_project_id is not null
        and exists (
          select 1
          from public.projects p
          where p.id = target_project_id
            and p.deleted_at is null
            and public.user_is_client_member(p.client_id)
        )
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

-- Update task_assignees policies
drop policy if exists "Users view task assignees" on public.task_assignees;
create policy "Users view task assignees" on public.task_assignees
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        where t.id = task_assignees.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

drop policy if exists "Project collaborators insert task assignees" on public.task_assignees;
create policy "Project collaborators insert task assignees" on public.task_assignees
  for insert with check (
    (select auth.uid()) is not null
    and public.is_admin()
  );

drop policy if exists "Project collaborators update task assignees" on public.task_assignees;
create policy "Project collaborators update task assignees" on public.task_assignees
  for update using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

drop policy if exists "Project collaborators delete task assignees" on public.task_assignees;
create policy "Project collaborators delete task assignees" on public.task_assignees
  for delete using (
    public.is_admin()
  );

-- Update task_comments policies
drop policy if exists "Users view task comments" on public.task_comments;
create policy "Users view task comments" on public.task_comments
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
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
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
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
          join public.projects p on p.id = t.project_id and p.deleted_at is null
          where t.id = task_comments.task_id
            and t.deleted_at is null
            and public.user_is_client_member(p.client_id)
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
        where t.id = task_comments.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

-- Update task_attachments policies
drop policy if exists "Users view task attachments" on public.task_attachments;
create policy "Users view task attachments" on public.task_attachments
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
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
        join public.projects p on p.id = t.project_id and p.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

drop policy if exists "Users update task attachments" on public.task_attachments;
create policy "Users update task attachments" on public.task_attachments
  for update using (
    deleted_at is null
    and public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Update time_logs policies
drop policy if exists "Users view time logs" on public.time_logs;
create policy "Users view time logs" on public.time_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.projects p
        where p.id = time_logs.project_id
          and p.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

-- Update time_logs INSERT policy
-- Note: The previous policy in 20251108000000 required both is_admin() AND user_is_project_member
-- This was incorrect - admins should be able to create time logs for any project
drop policy if exists "Users create time logs" on public.time_logs;
create policy "Users create time logs" on public.time_logs
  for insert with check (
    user_id = (select auth.uid())
    and public.is_admin()
  );

drop policy if exists "Users update time logs" on public.time_logs;
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
          where p.id = time_logs.project_id
            and p.deleted_at is null
            and public.user_is_client_member(p.client_id)
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
        where p.id = time_logs.project_id
          and p.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

-- Update time_log_tasks policies
drop policy if exists "Users view time log tasks" on public.time_log_tasks;
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
        join public.projects p on p.id = tl.project_id and p.deleted_at is null
        where tl.id = time_log_tasks.time_log_id
          and tl.deleted_at is null
          and public.user_is_client_member(p.client_id)
      )
    )
  );

-- Drop the user_is_project_member function
drop function if exists public.user_is_project_member(uuid);


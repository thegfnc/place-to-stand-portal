-- Optimize database functions and RLS policies for better performance
-- This migration:
-- 1. Removes redundant user_can_edit_project() function (just returns is_admin())
-- 2. Inlines user_is_client_member() calls in RLS policies to eliminate function call overhead
-- 3. Simplifies nested EXISTS clauses where possible
-- 4. Drops unused enums if they're not referenced
--
-- Performance improvements:
-- - Eliminates function call overhead in frequently evaluated RLS policies
-- - Simplifies query plans for better PostgreSQL optimization
-- - Reduces code complexity and maintenance burden

-- =====================================================================
-- Step 1: Drop redundant user_can_edit_project() function
-- =====================================================================
-- This function just returns is_admin(), so we can inline it everywhere
drop function if exists public.user_can_edit_project(uuid);

-- =====================================================================
-- Step 2: Update RLS policies to inline user_is_client_member() calls
-- =====================================================================
-- Inlining the EXISTS check eliminates function call overhead on every policy evaluation

-- Update clients policies
drop policy if exists "Users view clients" on public.clients;
create policy "Users view clients" on public.clients
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.client_members cm
        where cm.client_id = clients.id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
      )
    )
  );

-- Update projects policies
drop policy if exists "Users view projects" on public.projects;
create policy "Users view projects" on public.projects
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.client_members cm
        where cm.client_id = projects.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
      )
    )
  );

drop policy if exists "Users update projects" on public.projects;
create policy "Users update projects" on public.projects
  for update using (
    deleted_at is null
    and public.is_admin()
  ) with check (
    public.is_admin()
  );

-- Update tasks policies
drop policy if exists "Users view tasks" on public.tasks;
create policy "Users view tasks" on public.tasks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.projects p
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where p.id = tasks.project_id
          and p.deleted_at is null
      )
    )
  );

-- Update hour_blocks policies
drop policy if exists "Users view hour blocks" on public.hour_blocks;
create policy "Users view hour blocks" on public.hour_blocks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.client_members cm
        where cm.client_id = hour_blocks.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
      )
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
          join public.client_members cm on cm.client_id = p.client_id
            and cm.user_id = (select auth.uid())
            and cm.deleted_at is null
          where p.id = target_project_id
            and p.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_assignees.task_id
          and t.deleted_at is null
      )
    )
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_comments.task_id
          and t.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_comments.task_id
          and t.deleted_at is null
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
          join public.client_members cm on cm.client_id = p.client_id
            and cm.user_id = (select auth.uid())
            and cm.deleted_at is null
          where t.id = task_comments.task_id
            and t.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_comments.task_id
          and t.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where t.id = task_attachments.task_id
          and t.deleted_at is null
      )
    )
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where p.id = time_logs.project_id
          and p.deleted_at is null
      )
    )
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
          join public.client_members cm on cm.client_id = p.client_id
            and cm.user_id = (select auth.uid())
            and cm.deleted_at is null
          where p.id = time_logs.project_id
            and p.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where p.id = time_logs.project_id
          and p.deleted_at is null
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
        join public.client_members cm on cm.client_id = p.client_id
          and cm.user_id = (select auth.uid())
          and cm.deleted_at is null
        where tl.id = time_log_tasks.time_log_id
          and tl.deleted_at is null
      )
    )
  );

-- =====================================================================
-- Step 3: Drop user_is_client_member() function (no longer needed)
-- =====================================================================
-- After inlining all calls, we can drop the helper function
drop function if exists public.user_is_client_member(uuid);

-- =====================================================================
-- Step 4: Check and drop unused enums (if safe)
-- =====================================================================
-- Note: Only drop if no tables/columns reference them
-- member_role and hour_block_type should have been dropped already,
-- but we check to be safe

-- Check if member_role is still referenced
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'USER-DEFINED'
      and udt_name = 'member_role'
  ) then
    drop type if exists public.member_role;
  end if;
end $$;

-- Check if hour_block_type is still referenced
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'USER-DEFINED'
      and udt_name = 'hour_block_type'
  ) then
    drop type if exists public.hour_block_type;
  end if;
end $$;


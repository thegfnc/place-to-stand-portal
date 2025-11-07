-- Optimize RLS policies by wrapping auth.uid() calls with (select auth.uid())
-- This prevents re-evaluation of auth.uid() for each row, improving query performance at scale
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Users policies
drop policy if exists "Users can view themselves" on public.users;
create policy "Users can view themselves" on public.users
for select using ((select auth.uid()) = id and deleted_at is null);

-- Activity logs policies
drop policy if exists "Users insert their own activity logs" on public.activity_logs;
create policy "Users insert their own activity logs" on public.activity_logs
  for insert with check (
    actor_id = (select auth.uid())
  );

drop policy if exists "Users view accessible activity logs" on public.activity_logs;
create policy "Users view accessible activity logs" on public.activity_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or (
        target_project_id is not null
        and exists (
          select 1
          from public.project_members pm
          where pm.project_id = target_project_id
            and pm.user_id = (select auth.uid())
            and pm.deleted_at is null
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

-- Activity overview cache policies
drop policy if exists "Users can view their cached activity overview" on public.activity_overview_cache;
create policy "Users can view their cached activity overview"
	on public.activity_overview_cache
	for select
	using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their cached activity overview" on public.activity_overview_cache;
create policy "Users can insert their cached activity overview"
	on public.activity_overview_cache
	for insert
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their cached activity overview" on public.activity_overview_cache;
create policy "Users can update their cached activity overview"
	on public.activity_overview_cache
	for update
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their cached activity overview" on public.activity_overview_cache;
create policy "Users can delete their cached activity overview"
	on public.activity_overview_cache
	for delete
	using ((select auth.uid()) = user_id);

-- Task assignees policies
drop policy if exists "Members view task assignees" on public.task_assignees;
create policy "Members view task assignees" on public.task_assignees
for select using (
	exists (
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
	and deleted_at is null
);

-- Project members policies
-- Update helper functions to use (select auth.uid()) for better performance
create or replace function public.user_is_project_member(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_user_id
      and pm.deleted_at is null
  );
end;
$$;

create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_user_id
      and pm.deleted_at is null
  );
end;
$$;

create or replace function public.user_is_client_member(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.client_members cm
    where cm.client_id = p_client_id
      and cm.user_id = v_user_id
      and cm.deleted_at is null
  );
end;
$$;

-- Task comments policies
drop policy if exists "Project collaborators read task comments" on public.task_comments;
create policy "Project collaborators read task comments" on public.task_comments
	for select using (
		deleted_at is null
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
	);

drop policy if exists "Project collaborators create task comments" on public.task_comments;
create policy "Project collaborators create task comments" on public.task_comments
	for insert with check (
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
	);

drop policy if exists "Authors update their task comments" on public.task_comments;
create policy "Authors update their task comments" on public.task_comments
	for update using (
		author_id = (select auth.uid())
		and deleted_at is null
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
	) with check (
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
	);

-- Time logs policies
drop policy if exists "Project collaborators read time logs" on public.time_logs;
create policy "Project collaborators read time logs" on public.time_logs
	for select using (
		deleted_at is null
		and exists (
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
	);

drop policy if exists "Authors update their time logs" on public.time_logs;
create policy "Authors update their time logs" on public.time_logs
	for update using (
		user_id = (select auth.uid())
		and deleted_at is null
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
	) with check (
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
	);

drop policy if exists "Admins log time on assigned projects" on public.time_logs;
create policy "Admins log time on assigned projects" on public.time_logs
	for insert with check (
		user_id = (select auth.uid())
		and exists (
			select 1
			from public.users u
			where u.id = (select auth.uid())
				and u.deleted_at is null
				and u.role = 'ADMIN'
		)
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

-- Client members policies
drop policy if exists "Members view their client assignments" on public.client_members;
create policy "Members view their client assignments" on public.client_members
	for select using (
		user_id = (select auth.uid())
		and deleted_at is null
	);

-- Time log tasks policies
drop policy if exists "Authors manage their time log tasks" on public.time_log_tasks;
create policy "Authors manage their time log tasks" on public.time_log_tasks
  for all using (
    exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  ) with check (
    exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = (select auth.uid())
        and tl.deleted_at is null
    )
  );

drop policy if exists "Project collaborators read time log tasks" on public.time_log_tasks;
create policy "Project collaborators read time log tasks" on public.time_log_tasks
  for select using (
    time_log_tasks.deleted_at is null
    and exists (
      select 1
      from public.time_logs tl
      join public.projects p on p.id = tl.project_id
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
        and p.deleted_at is null
        and (
          pm.id is not null
          or cm.id is not null
        )
    )
  );

-- Task attachments policies
drop policy if exists "Project collaborators read task attachments" on public.task_attachments;
create policy "Project collaborators read task attachments" on public.task_attachments
	for select using (
		deleted_at is null
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
			where t.id = task_attachments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

drop policy if exists "Project collaborators create task attachments" on public.task_attachments;
create policy "Project collaborators create task attachments" on public.task_attachments
	for insert with check (
		(select auth.uid()) = uploaded_by
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
			where t.id = task_attachments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

drop policy if exists "Project managers update task attachments" on public.task_attachments;
create policy "Project managers update task attachments" on public.task_attachments
	for update using (
		deleted_at is null
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = (select auth.uid())
				and pm.deleted_at is null
		)
	)
	with check (
		exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = (select auth.uid())
				and pm.deleted_at is null
		)
	);


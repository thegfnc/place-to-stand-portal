create or replace function public.task_matches_project(p_task_id uuid, p_project_id uuid)
returns boolean
language sql
stable
as $$
	select
		$1 is null
		or exists (
			select 1
			from public.tasks t
			where t.id = $1
				and t.deleted_at is null
				and t.project_id = $2
		);
$$;

create table public.time_logs (
	id uuid primary key default gen_random_uuid(),
	project_id uuid not null references public.projects (id) on delete cascade,
	task_id uuid references public.tasks (id) on delete set null,
	user_id uuid not null references public.users (id) on delete cascade,
	hours numeric(8,2) not null check (hours > 0),
	logged_on date not null default timezone('utc', now())::date,
	note text,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	deleted_at timestamptz,
	constraint time_logs_task_project_match
		check (public.task_matches_project(task_id, project_id))
);

create trigger time_logs_set_updated_at
	before update on public.time_logs
	for each row
	execute function public.set_updated_at();

create index idx_time_logs_project on public.time_logs (project_id)
	where deleted_at is null;

create index idx_time_logs_task on public.time_logs (task_id)
	where deleted_at is null;

create index idx_time_logs_user on public.time_logs (user_id)
	where deleted_at is null;

alter table public.time_logs enable row level security;

create policy "Admins manage time logs" on public.time_logs
	using (public.is_admin())
	with check (public.is_admin());

create policy "Project collaborators read time logs" on public.time_logs
	for select using (
		deleted_at is null
		and exists (
			select 1
			from public.projects p
			left join public.project_members pm
				on pm.project_id = p.id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			left join public.client_members cm
				on cm.client_id = p.client_id
				and cm.user_id = auth.uid()
				and cm.deleted_at is null
			where p.id = time_logs.project_id
				and p.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

create policy "Contractors log time on assigned projects" on public.time_logs
	for insert with check (
		user_id = auth.uid()
		and exists (
			select 1
			from public.users u
			where u.id = auth.uid()
				and u.deleted_at is null
				and u.role = 'CONTRACTOR'
		)
		and exists (
			select 1
			from public.projects p
			left join public.project_members pm
				on pm.project_id = p.id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			where p.id = time_logs.project_id
				and p.deleted_at is null
				and pm.id is not null
		)
	);

create policy "Authors update their time logs" on public.time_logs
	for update using (
		user_id = auth.uid()
		and deleted_at is null
		and exists (
			select 1
			from public.projects p
			left join public.project_members pm
				on pm.project_id = p.id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			where p.id = time_logs.project_id
				and p.deleted_at is null
				and pm.id is not null
		)
	) with check (
		user_id = auth.uid()
		and exists (
			select 1
			from public.projects p
			left join public.project_members pm
				on pm.project_id = p.id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			where p.id = time_logs.project_id
				and p.deleted_at is null
				and pm.id is not null
		)
	);


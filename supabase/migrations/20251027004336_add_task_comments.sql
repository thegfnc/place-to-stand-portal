create table public.task_comments (
	id uuid primary key default gen_random_uuid(),
	task_id uuid not null references public.tasks (id) on delete cascade,
	author_id uuid not null references public.users (id) on delete cascade,
	body text not null,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	deleted_at timestamptz
);

create trigger task_comments_set_updated_at
	before update on public.task_comments
	for each row
	execute function public.set_updated_at();

create index idx_task_comments_task on public.task_comments (task_id)
	where deleted_at is null;

alter table public.task_comments enable row level security;

create policy "Admins manage task comments" on public.task_comments
	using (public.is_admin())
	with check (public.is_admin());

create policy "Project collaborators read task comments" on public.task_comments
	for select using (
		deleted_at is null
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			left join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			left join public.client_members cm
				on cm.client_id = p.client_id
				and cm.user_id = auth.uid()
				and cm.deleted_at is null
			where t.id = task_comments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

create policy "Project collaborators create task comments" on public.task_comments
	for insert with check (
		author_id = auth.uid()
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			left join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			left join public.client_members cm
				on cm.client_id = p.client_id
				and cm.user_id = auth.uid()
				and cm.deleted_at is null
			where t.id = task_comments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

create policy "Authors update their task comments" on public.task_comments
	for update using (
		author_id = auth.uid()
		and deleted_at is null
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			left join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			left join public.client_members cm
				on cm.client_id = p.client_id
				and cm.user_id = auth.uid()
				and cm.deleted_at is null
			where t.id = task_comments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	) with check (
		author_id = auth.uid()
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			left join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			left join public.client_members cm
				on cm.client_id = p.client_id
				and cm.user_id = auth.uid()
				and cm.deleted_at is null
			where t.id = task_comments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);


create table public.task_attachments (
	id uuid primary key default gen_random_uuid(),
	task_id uuid not null references public.tasks (id) on delete cascade,
	storage_path text not null,
	original_name text not null,
	mime_type text not null,
	file_size bigint not null,
	uploaded_by uuid not null references public.users (id) on delete cascade,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	deleted_at timestamptz
);

create trigger task_attachments_set_updated_at
	before update on public.task_attachments
	for each row
	execute function public.set_updated_at();

create index idx_task_attachments_task on public.task_attachments (task_id)
	where deleted_at is null;

alter table public.task_attachments enable row level security;

create policy "Admins manage task attachments" on public.task_attachments
	using (public.is_admin())
	with check (public.is_admin());

create policy "Project collaborators read task attachments" on public.task_attachments
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
			where t.id = task_attachments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

create policy "Project collaborators create task attachments" on public.task_attachments
	for insert with check (
		auth.uid() = uploaded_by
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
			where t.id = task_attachments.task_id
				and t.deleted_at is null
				and (
					pm.id is not null
					or cm.id is not null
				)
		)
	);

create policy "Project managers update task attachments" on public.task_attachments
	for update using (
		deleted_at is null
		and exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
				and pm.role in ('OWNER', 'CONTRIBUTOR')
		)
	)
	with check (
		exists (
			select 1
			from public.tasks t
			join public.projects p on p.id = t.project_id and p.deleted_at is null
			join public.project_members pm
				on pm.project_id = t.project_id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
				and pm.role in ('OWNER', 'CONTRIBUTOR')
		)
	);

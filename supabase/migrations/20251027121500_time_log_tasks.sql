drop index if exists idx_time_logs_task;

alter table public.time_logs
  drop constraint if exists time_logs_task_project_match;

alter table public.time_logs
  drop column if exists task_id;

create or replace function public.time_log_task_matches_project(
  p_time_log_id uuid,
  p_task_id uuid
) returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.time_logs tl
    join public.tasks t on t.id = p_task_id
    where tl.id = p_time_log_id
      and tl.project_id = t.project_id
      and tl.deleted_at is null
      and t.deleted_at is null
  );
$$;

create table public.time_log_tasks (
  id uuid primary key default gen_random_uuid(),
  time_log_id uuid not null references public.time_logs (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint time_log_tasks_project_match
    check (public.time_log_task_matches_project(time_log_id, task_id))
);

create trigger time_log_tasks_set_updated_at
  before update on public.time_log_tasks
  for each row
  execute function public.set_updated_at();

create index idx_time_log_tasks_time_log on public.time_log_tasks (time_log_id)
  where deleted_at is null;

create index idx_time_log_tasks_task on public.time_log_tasks (task_id)
  where deleted_at is null;

create unique index idx_time_log_tasks_unique on public.time_log_tasks (time_log_id, task_id)
  where deleted_at is null;

alter table public.time_log_tasks enable row level security;

create policy "Admins manage time log tasks" on public.time_log_tasks
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "Authors manage their time log tasks" on public.time_log_tasks
  for all using (
    exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = auth.uid()
        and tl.deleted_at is null
    )
  ) with check (
    exists (
      select 1
      from public.time_logs tl
      where tl.id = time_log_tasks.time_log_id
        and tl.user_id = auth.uid()
        and tl.deleted_at is null
    )
  );

create policy "Project collaborators read time log tasks" on public.time_log_tasks
  for select using (
    time_log_tasks.deleted_at is null
    and exists (
      select 1
      from public.time_logs tl
      join public.projects p on p.id = tl.project_id
      left join public.project_members pm
        on pm.project_id = p.id
        and pm.user_id = auth.uid()
        and pm.deleted_at is null
      left join public.client_members cm
        on cm.client_id = p.client_id
        and cm.user_id = auth.uid()
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

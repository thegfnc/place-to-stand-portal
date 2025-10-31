alter table public.tasks
  add column if not exists accepted_at timestamptz;

create index if not exists idx_tasks_project_accepted
  on public.tasks (project_id, accepted_at)
  where accepted_at is not null;

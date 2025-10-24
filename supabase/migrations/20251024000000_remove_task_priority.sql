-- Remove the obsolete task priority column and enum
alter table public.tasks
  drop column if exists priority;

drop type if exists public.task_priority;

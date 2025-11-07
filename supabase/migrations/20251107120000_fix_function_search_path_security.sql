-- Fix security issue: Set immutable search_path for functions
-- This prevents search_path manipulation attacks by making the search_path immutable

-- Fix set_updated_at function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
SET search_path = ''
as $$
begin
	new.updated_at = timezone('utc', now());
	return new;
end;
$$;

-- Fix task_matches_project function
create or replace function public.task_matches_project(p_task_id uuid, p_project_id uuid)
returns boolean
language sql
stable
SET search_path = ''
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

-- Fix time_log_task_matches_project function
create or replace function public.time_log_task_matches_project(
  p_time_log_id uuid,
  p_task_id uuid
) returns boolean
language sql
stable
SET search_path = ''
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


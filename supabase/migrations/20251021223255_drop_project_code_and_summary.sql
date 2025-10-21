-- Drop unused project metadata columns and align status defaults
alter table public.projects
	drop column if exists code,
	drop column if exists description;

-- Normalize existing status casing and retire archived state
update public.projects
set status = lower(status);

update public.projects
set status = 'completed'
where status = 'archived';

alter table public.projects
	alter column status set default 'active';

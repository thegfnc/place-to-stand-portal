alter table public.projects
	add column if not exists slug text;

create unique index if not exists idx_projects_slug
	on public.projects (slug)
	where slug is not null;

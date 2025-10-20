create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.project_members pm
		where pm.project_id = target_project_id
			and pm.user_id = auth.uid()
			and pm.deleted_at is null
	);
$$;

drop policy if exists "Members view project members" on public.project_members;

create policy "Members view project members" on public.project_members
for select using (
	public.is_project_member(project_members.project_id)
	and deleted_at is null
);

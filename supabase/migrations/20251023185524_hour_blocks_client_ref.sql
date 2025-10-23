-- Reassociate hour blocks with clients instead of projects

-- Remove existing data since project associations are no longer valid
delete from public.hour_blocks;

-- Drop the old member visibility policy so the project column can be removed
drop policy if exists "Members view hour blocks" on public.hour_blocks;

-- Drop the old foreign key and related index
alter table public.hour_blocks
	drop constraint if exists hour_blocks_project_id_fkey;

drop index if exists public.idx_hour_blocks_project;

-- Replace project reference with client reference
alter table public.hour_blocks
	drop column if exists project_id,
	add column client_id uuid;

alter table public.hour_blocks
	add constraint hour_blocks_client_id_fkey
	foreign key (client_id) references public.clients (id) on delete cascade;

alter table public.hour_blocks
	alter column client_id set not null;

create index idx_hour_blocks_client
	on public.hour_blocks (client_id)
	where deleted_at is null;

create policy "Members view hour blocks" on public.hour_blocks
for select using (
	exists (
		select 1
		from public.project_members pm
		join public.projects p on p.id = pm.project_id and p.deleted_at is null
		where p.client_id = hour_blocks.client_id
			and pm.user_id = auth.uid()
			and pm.deleted_at is null
	)
	and deleted_at is null
);

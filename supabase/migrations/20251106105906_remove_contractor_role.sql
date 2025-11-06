-- Step 1: Update all users with CONTRACTOR role to ADMIN
update public.users
set role = 'ADMIN'::public.user_role
where role = 'CONTRACTOR'::public.user_role;

-- Step 2: Create a new enum type without CONTRACTOR
create type public.user_role_new as enum ('ADMIN', 'CLIENT');

-- Step 3: Update all columns that use user_role to use the new enum
-- First, drop objects that depend on the role column
drop view if exists public.current_user_with_role;
drop policy if exists "Contractors log time on assigned projects" on public.time_logs;

-- Drop the default constraint, then alter the column type, then restore the default
alter table public.users
  alter column role drop default;

alter table public.users
  alter column role type public.user_role_new
  using role::text::public.user_role_new;

alter table public.users
  alter column role set default 'CLIENT'::public.user_role_new;

-- Recreate the view with the new enum type
create or replace view public.current_user_with_role as
select u.id, u.role
from public.users u
where u.id = auth.uid() and u.deleted_at is null;

-- Update activity_logs table if it exists and uses user_role
-- Note: activity_logs.actor_role doesn't have a default, so we can just alter the type
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_logs'
      and column_name = 'actor_role'
  ) then
    alter table public.activity_logs
      alter column actor_role type public.user_role_new
      using actor_role::text::public.user_role_new;
  end if;
end $$;

-- Step 4: Update functions that return user_role
-- Drop existing functions first (can't change return type with CREATE OR REPLACE)
-- Use CASCADE to drop any dependent objects (like policies that use these functions)
drop function if exists public.resolve_actor_role(uuid) cascade;
drop function if exists public.log_activity(uuid, public.user_role, text, text, text, uuid, uuid, uuid, text, jsonb) cascade;

-- Recreate resolve_actor_role function to use ADMIN as default instead of CONTRACTOR
create function public.resolve_actor_role(p_actor_id uuid)
returns public.user_role_new
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(u.role, 'ADMIN'::public.user_role_new)
  from public.users u
  where u.id = p_actor_id
    and u.deleted_at is null
  limit 1;
$$;

-- Recreate log_activity function signature
create function public.log_activity(
  p_actor_id uuid,
  p_actor_role public.user_role_new,
  p_verb text,
  p_summary text,
  p_target_type text,
  p_target_id uuid default null,
  p_target_client_id uuid default null,
  p_target_project_id uuid default null,
  p_context_route text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_role public.user_role_new;
begin
  if v_actor is null then
    raise exception 'log_activity requires an actor id';
  end if;

  if p_summary is null or length(trim(p_summary)) = 0 then
    raise exception 'log_activity summary cannot be empty';
  end if;

  v_role := coalesce(p_actor_role, public.resolve_actor_role(v_actor));

  insert into public.activity_logs (
    actor_id,
    actor_role,
    verb,
    summary,
    target_type,
    target_id,
    target_client_id,
    target_project_id,
    context_route,
    metadata
  ) values (
    v_actor,
    v_role,
    p_verb,
    p_summary,
    p_target_type,
    p_target_id,
    p_target_client_id,
    p_target_project_id,
    p_context_route,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Step 5: Drop the old enum and rename the new one
-- Note: We already recreated the current_user_with_role view above with the new enum type
drop type public.user_role;
alter type public.user_role_new rename to user_role;

-- Step 5b: Recreate functions with the correct type name after rename
-- After renaming the type, the functions still reference user_role_new in their source
-- but the type is now called user_role. Drop and recreate to update the function definitions.
-- Drop by name only - PostgreSQL will find the right overload
drop function if exists public.resolve_actor_role cascade;
drop function if exists public.log_activity cascade;

-- Recreate with the correct type name (user_role)
create function public.resolve_actor_role(p_actor_id uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(u.role, 'ADMIN'::public.user_role)
  from public.users u
  where u.id = p_actor_id
    and u.deleted_at is null
  limit 1;
$$;

create function public.log_activity(
  p_actor_id uuid,
  p_actor_role public.user_role,
  p_verb text,
  p_summary text,
  p_target_type text,
  p_target_id uuid default null,
  p_target_client_id uuid default null,
  p_target_project_id uuid default null,
  p_context_route text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_role public.user_role;
begin
  if v_actor is null then
    raise exception 'log_activity requires an actor id';
  end if;

  if p_summary is null or length(trim(p_summary)) = 0 then
    raise exception 'log_activity summary cannot be empty';
  end if;

  v_role := coalesce(p_actor_role, public.resolve_actor_role(v_actor));

  insert into public.activity_logs (
    actor_id,
    actor_role,
    verb,
    summary,
    target_type,
    target_id,
    target_client_id,
    target_project_id,
    context_route,
    metadata
  ) values (
    v_actor,
    v_role,
    p_verb,
    p_summary,
    p_target_type,
    p_target_id,
    p_target_client_id,
    p_target_project_id,
    p_context_route,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Step 6: Recreate RLS policies that reference CONTRACTOR
-- Recreate time_logs policy to check for ADMIN instead of CONTRACTOR
-- (We already dropped it in Step 3, now we recreate it with the updated logic)
create policy "Admins log time on assigned projects" on public.time_logs
	for insert with check (
		user_id = auth.uid()
		and exists (
			select 1
			from public.users u
			where u.id = auth.uid()
				and u.deleted_at is null
				and u.role = 'ADMIN'
		)
		and exists (
			select 1
			from public.projects p
			left join public.project_members pm
				on pm.project_id = p.id
				and pm.user_id = auth.uid()
				and pm.deleted_at is null
			where p.id = time_logs.project_id
				and p.deleted_at is null
				and pm.id is not null
		)
	);


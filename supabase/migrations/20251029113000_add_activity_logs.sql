create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users (id) on delete cascade,
  actor_role public.user_role not null,
  verb text not null,
  summary text not null,
  target_type text not null,
  target_id uuid,
  target_client_id uuid,
  target_project_id uuid,
  context_route text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  restored_at timestamptz
);

create trigger activity_logs_set_updated_at
  before update on public.activity_logs
  for each row
  execute function public.set_updated_at();

create index idx_activity_logs_created_at on public.activity_logs (created_at desc);

create index idx_activity_logs_target on public.activity_logs (target_type, target_id)
  where deleted_at is null;

create index idx_activity_logs_project on public.activity_logs (target_project_id, created_at desc)
  where deleted_at is null;

create index idx_activity_logs_client on public.activity_logs (target_client_id, created_at desc)
  where deleted_at is null;

alter table public.activity_logs enable row level security;

create or replace function public.resolve_actor_role(p_actor_id uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(u.role, 'CONTRACTOR'::public.user_role)
  from public.users u
  where u.id = p_actor_id
    and u.deleted_at is null
  limit 1;
$$;

create or replace function public.log_activity(
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

create policy "Admins manage activity logs" on public.activity_logs
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users insert their own activity logs" on public.activity_logs
  for insert with check (
    actor_id = auth.uid()
  );

create policy "Users view accessible activity logs" on public.activity_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or actor_id = auth.uid()
      or (
        target_project_id is not null
        and exists (
          select 1
          from public.project_members pm
          where pm.project_id = target_project_id
            and pm.user_id = auth.uid()
            and pm.deleted_at is null
        )
      )
      or (
        target_client_id is not null
        and exists (
          select 1
          from public.client_members cm
          where cm.client_id = target_client_id
            and cm.user_id = auth.uid()
            and cm.deleted_at is null
        )
      )
    )
  );

create policy "Admins restore or archive activity logs" on public.activity_logs
  for update using (public.is_admin())
  with check (public.is_admin());

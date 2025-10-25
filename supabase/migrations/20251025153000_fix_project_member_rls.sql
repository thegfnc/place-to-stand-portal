-- Helper functions to evaluate membership without causing recursive policy evaluation
create or replace function public.user_is_project_member(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_user_id
      and pm.deleted_at is null
  );
end;
$$;

create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_user_id
      and pm.deleted_at is null
      and pm.role in ('OWNER', 'CONTRIBUTOR')
  );
end;
$$;

create or replace function public.user_is_client_member(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.client_members cm
    where cm.client_id = p_client_id
      and cm.user_id = v_user_id
      and cm.deleted_at is null
  );
end;
$$;

-- Refresh policies that previously queried project_members directly

-- Project membership policies

drop policy if exists "Members view project members" on public.project_members;

create policy "Members view project members" on public.project_members
for select using (
  deleted_at is null
  and public.user_is_project_member(project_members.project_id)
);

-- Project policies

drop policy if exists "Members read projects" on public.projects;

drop policy if exists "Members update their projects" on public.projects;

create policy "Members read projects" on public.projects
for select using (
  deleted_at is null
  and (
    public.user_is_project_member(projects.id)
    or public.user_is_client_member(projects.client_id)
  )
);

create policy "Members update their projects" on public.projects
for update using (
  public.is_admin() or public.user_can_edit_project(projects.id)
)
with check (
  public.is_admin() or public.user_can_edit_project(projects.id)
);

-- Client visibility policy

drop policy if exists "Members read clients" on public.clients;

create policy "Members read clients" on public.clients
for select using (
  deleted_at is null
  and (
    public.user_is_client_member(clients.id)
    or exists (
      select 1
      from public.projects p
      where p.client_id = clients.id
        and p.deleted_at is null
        and public.user_is_project_member(p.id)
    )
  )
);

-- Hour block visibility leverages helper functions to avoid recursive policy evaluation

drop policy if exists "Members view hour blocks" on public.hour_blocks;

create policy "Members view hour blocks" on public.hour_blocks
for select using (
  deleted_at is null
  and (
    public.user_is_client_member(hour_blocks.client_id)
    or exists (
      select 1
      from public.projects p
      where p.client_id = hour_blocks.client_id
        and p.deleted_at is null
        and public.user_is_project_member(p.id)
    )
  )
);

-- Task policy rewritten to reuse helper functions for clarity

drop policy if exists "Project members manage tasks" on public.tasks;

create policy "Project members manage tasks" on public.tasks
using (
  deleted_at is null
  and public.user_is_project_member(tasks.project_id)
)
with check (
  public.user_can_edit_project(tasks.project_id)
);

-- Remove member_role enum and role column from project_members table

-- Update user_can_edit_project function to remove role check
-- Now it just checks if the user is a project member
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
  );
end;
$$;

-- Update task attachments policy to remove role check
drop policy if exists "Project managers update task attachments" on public.task_attachments;

create policy "Project managers update task attachments" on public.task_attachments
for update using (
  deleted_at is null
  and exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.deleted_at is null
    join public.project_members pm
      on pm.project_id = t.project_id
      and pm.user_id = auth.uid()
      and pm.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.deleted_at is null
    join public.project_members pm
      on pm.project_id = t.project_id
      and pm.user_id = auth.uid()
      and pm.deleted_at is null
  )
);

-- Drop the role column from project_members table
alter table public.project_members drop column if exists role;

-- Drop the member_role enum type
drop type if exists public.member_role;


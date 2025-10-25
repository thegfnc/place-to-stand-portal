-- Simplify project member visibility to avoid recursive policy evaluation

drop policy if exists "Members view project members" on public.project_members;

create policy "Members view project members" on public.project_members
for select using (
  deleted_at is null
  and user_id = auth.uid()
);

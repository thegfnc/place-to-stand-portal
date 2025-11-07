-- Consolidate RLS policies for clients table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies (admin using+with_check for all ops, member for select)
-- After: 1 policy per operation (consolidated select, separate admin for modify ops)
--
-- Note: Uses helper functions from migration 20251025153000
-- Rollback: If needed, restore the original policies from migration 20251025153000

-- Drop existing policies
drop policy if exists "Admins full access to clients" on public.clients;
drop policy if exists "Members read clients" on public.clients;

-- Create consolidated SELECT policy (admin OR member with helper function)
create policy "Users view clients" on public.clients
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_client_member(clients.id)
      or exists (
        select 1
        from public.projects p
        where p.client_id = clients.id
          and p.deleted_at is null
          and public.user_is_project_member(p.id)
      )
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Note: Currently only admins can modify clients
-- If member modifications are needed in future, add OR conditions here
create policy "Admins manage clients" on public.clients
  for insert, update, delete using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );


-- Consolidate RLS policies for clients table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Admins full access to clients": using+with_check for all operations (includes SELECT)
--   - "Members read clients": for select only
-- After: 4 policies (eliminates duplicate SELECT)
--   - "Users view clients": consolidated SELECT (admin OR member with helper functions)
--   - "Admins insert clients": INSERT (admin only)
--   - "Admins update clients": UPDATE (admin only)
--   - "Admins delete clients": DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Note: Uses helper functions user_is_client_member and user_is_project_member from migration 20251025153000
--
-- Rollback: If needed, restore policies from migration 20251025153000
--   drop policy if exists "Users view clients" on public.clients;
--   drop policy if exists "Admins insert clients" on public.clients;
--   drop policy if exists "Admins update clients" on public.clients;
--   drop policy if exists "Admins delete clients" on public.clients;
--   create policy "Admins full access to clients" on public.clients
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members read clients" on public.clients
--     for select using (
--       deleted_at is null
--       and (
--         public.user_is_client_member(clients.id)
--         or exists (
--           select 1
--           from public.projects p
--           where p.client_id = clients.id
--             and p.deleted_at is null
--             and public.user_is_project_member(p.id)
--         )
--       )
--     );

-- Drop existing policies
drop policy if exists "Admins full access to clients" on public.clients;
drop policy if exists "Members read clients" on public.clients;

-- Create consolidated SELECT policy (admin OR member with helper functions)
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
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert clients" on public.clients
  for insert with check (
    public.is_admin()
  );

create policy "Admins update clients" on public.clients
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete clients" on public.clients
  for delete using (
    public.is_admin()
  );


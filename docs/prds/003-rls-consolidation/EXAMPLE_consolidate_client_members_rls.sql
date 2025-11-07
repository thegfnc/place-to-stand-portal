-- Consolidate RLS policies for client_members table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies (admin using+with_check for all ops, member for select)
-- After: 1 policy per operation (consolidated select, separate admin for modify ops)
--
-- Rollback: If needed, restore the original policies from migration 20251023211946

-- Drop existing policies
drop policy if exists "Admins manage client members" on public.client_members;
drop policy if exists "Members view their client assignments" on public.client_members;

-- Create consolidated SELECT policy (admin OR member)
create policy "Users view client members" on public.client_members
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or user_id = (select auth.uid())
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only for now)
-- Note: Currently only admins can modify client_members
-- If member modifications are needed in future, add OR conditions here
create policy "Admins manage client members" on public.client_members
  for insert, update, delete using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );


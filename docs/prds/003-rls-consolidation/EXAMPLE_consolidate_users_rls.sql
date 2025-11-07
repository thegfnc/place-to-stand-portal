-- Consolidate RLS policies for users table
-- This migration combines the admin and self-view policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies (self-view for select, admin using+with_check for all ops)
-- After: 1 policy per operation (consolidated select, separate admin for modify ops)
--
-- Rollback: If needed, restore the original policies from migration 20251020192933

-- Drop existing policies
drop policy if exists "Users can view themselves" on public.users;
drop policy if exists "Admins manage users" on public.users;

-- Create consolidated SELECT policy (admin OR self-view)
create policy "Users view accessible users" on public.users
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or (select auth.uid()) = id
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
create policy "Admins manage users" on public.users
  for insert, update, delete using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );


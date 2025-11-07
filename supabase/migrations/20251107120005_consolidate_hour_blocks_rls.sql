-- Consolidate RLS policies for hour_blocks table
-- This migration combines the admin and member policies for SELECT operation
-- into a single policy to improve query performance.
--
-- Before: 2 policies
--   - "Admins manage hour blocks": using+with_check for all operations (includes SELECT)
--   - "Members view hour blocks": for select only
-- After: 2 policies (1 per operation type)
--   - "Users view hour blocks": consolidated SELECT (admin OR client/project member)
--   - "Admins manage hour blocks": INSERT/UPDATE/DELETE (admin only)
--
-- This eliminates the duplicate SELECT policy while maintaining the same access controls.
--
-- Note: Uses helper functions user_is_client_member and user_is_project_member from migration 20251025153000
--
-- Rollback: If needed, restore policies from migration 20251025153000
--   drop policy if exists "Users view hour blocks" on public.hour_blocks;
--   drop policy if exists "Admins manage hour blocks" on public.hour_blocks;
--   create policy "Admins manage hour blocks" on public.hour_blocks
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Members view hour blocks" on public.hour_blocks
--     for select using (
--       deleted_at is null
--       and (
--         public.user_is_client_member(hour_blocks.client_id)
--         or exists (
--           select 1
--           from public.projects p
--           where p.client_id = hour_blocks.client_id
--             and p.deleted_at is null
--             and public.user_is_project_member(p.id)
--         )
--       )
--     );

-- Drop existing policies
drop policy if exists "Admins manage hour blocks" on public.hour_blocks;
drop policy if exists "Members view hour blocks" on public.hour_blocks;

-- Create consolidated SELECT policy (admin OR client/project member)
create policy "Users view hour blocks" on public.hour_blocks
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or public.user_is_client_member(hour_blocks.client_id)
      or exists (
        select 1
        from public.projects p
        where p.client_id = hour_blocks.client_id
          and p.deleted_at is null
          and public.user_is_project_member(p.id)
      )
    )
  );

-- Create consolidated policies for INSERT, UPDATE, DELETE (admin only)
-- Using separate policies for each operation to avoid overlap with SELECT
create policy "Admins insert hour blocks" on public.hour_blocks
  for insert with check (
    public.is_admin()
  );

create policy "Admins update hour blocks" on public.hour_blocks
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "Admins delete hour blocks" on public.hour_blocks
  for delete using (
    public.is_admin()
  );


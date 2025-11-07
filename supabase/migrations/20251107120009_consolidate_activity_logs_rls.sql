-- Consolidate RLS policies for activity_logs table
-- This migration combines the admin and user policies for SELECT, INSERT, and UPDATE operations
-- into single policies per operation to improve query performance.
--
-- Before: 4 policies
--   - "Admins manage activity logs": using+with_check for all operations (includes SELECT, INSERT, UPDATE, DELETE)
--   - "Users insert their own activity logs": for insert only
--   - "Users view accessible activity logs": for select only
--   - "Admins restore or archive activity logs": for update only
-- After: 4 policies (eliminates duplicates for SELECT, INSERT, UPDATE)
--   - "Users view activity logs": consolidated SELECT (admin OR user viewing own/accessible logs)
--   - "Users insert activity logs": consolidated INSERT (admin OR user inserting own logs)
--   - "Admins update activity logs": consolidated UPDATE (admin only - restore/archive)
--   - "Admins delete activity logs": DELETE (admin only)
--
-- This eliminates duplicate policies for SELECT, INSERT, and UPDATE while maintaining the same access controls.
--
-- Note: Uses helper functions and direct checks for project/client membership
--
-- Rollback: If needed, restore policies from migration 20251107082130
--   drop policy if exists "Users view activity logs" on public.activity_logs;
--   drop policy if exists "Users insert activity logs" on public.activity_logs;
--   drop policy if exists "Admins update activity logs" on public.activity_logs;
--   drop policy if exists "Admins delete activity logs" on public.activity_logs;
--   create policy "Admins manage activity logs" on public.activity_logs
--     using (public.is_admin()) with check (public.is_admin());
--   create policy "Users insert their own activity logs" on public.activity_logs
--     for insert with check (actor_id = (select auth.uid()));
--   create policy "Users view accessible activity logs" on public.activity_logs
--     for select using (
--       deleted_at is null
--       and (
--         public.is_admin()
--         or actor_id = (select auth.uid())
--         or (
--           target_project_id is not null
--           and exists (
--             select 1
--             from public.project_members pm
--             where pm.project_id = target_project_id
--               and pm.user_id = (select auth.uid())
--               and pm.deleted_at is null
--           )
--         )
--         or (
--           target_client_id is not null
--           and exists (
--             select 1
--             from public.client_members cm
--             where cm.client_id = target_client_id
--               and cm.user_id = (select auth.uid())
--               and cm.deleted_at is null
--           )
--         )
--       )
--     );
--   create policy "Admins restore or archive activity logs" on public.activity_logs
--     for update using (public.is_admin()) with check (public.is_admin());

-- Drop existing policies
drop policy if exists "Admins manage activity logs" on public.activity_logs;
drop policy if exists "Users insert their own activity logs" on public.activity_logs;
drop policy if exists "Users view accessible activity logs" on public.activity_logs;
drop policy if exists "Admins restore or archive activity logs" on public.activity_logs;

-- Create consolidated SELECT policy (admin OR user viewing own/accessible logs)
create policy "Users view activity logs" on public.activity_logs
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or (
        target_project_id is not null
        and exists (
          select 1
          from public.project_members pm
          where pm.project_id = target_project_id
            and pm.user_id = (select auth.uid())
            and pm.deleted_at is null
        )
      )
      or (
        target_client_id is not null
        and exists (
          select 1
          from public.client_members cm
          where cm.client_id = target_client_id
            and cm.user_id = (select auth.uid())
            and cm.deleted_at is null
        )
      )
    )
  );

-- Create consolidated INSERT policy (admin OR user inserting own logs)
create policy "Users insert activity logs" on public.activity_logs
  for insert with check (
    public.is_admin()
    or actor_id = (select auth.uid())
  );

-- Create consolidated UPDATE policy (admin only - for restore/archive operations)
create policy "Admins update activity logs" on public.activity_logs
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

-- Create DELETE policy (admin only)
create policy "Admins delete activity logs" on public.activity_logs
  for delete using (
    public.is_admin()
  );


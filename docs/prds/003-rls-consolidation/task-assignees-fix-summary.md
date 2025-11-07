# Task Assignees RLS Fix - Summary

## Problem
After consolidating RLS policies, task assignees couldn't be updated when saving tasks. Error: "new row violates row-level security policy for table 'task_assignees'"

## Root Cause
The `syncAssignees` function uses a pattern that:
1. First UPDATEs all assignees to set `deleted_at` (soft delete)
2. Then UPSERTs to restore some assignees (UPDATE existing rows with `deleted_at = null`)

The original consolidation made INSERT/UPDATE/DELETE admin-only, but project members with edit permission need to manage assignees.

## Solution
Created migration `20251107120014_clean_fix_task_assignees_rls.sql` that:

1. **Allows project members with edit permission** to INSERT/UPDATE/DELETE task assignees
2. **Uses the same permission pattern as tasks table**: If you can edit a task, you can manage its assignees
3. **Handles the UPSERT pattern correctly**: UPDATE policy allows updating rows even if `deleted_at` is set (needed for restore operations)
4. **Uses helper function `user_can_edit_project`**: Security definer function that bypasses RLS to avoid circular dependencies

## Key Policies

### INSERT Policy
```sql
create policy "Users insert task assignees" on public.task_assignees
  for insert with check (
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_can_edit_project(t.project_id)
    )
  );
```

### UPDATE Policy (Critical)
```sql
create policy "Users update task assignees" on public.task_assignees
  for update using (
    -- CRITICAL: Don't check deleted_at on task_assignees - allow updating soft-deleted rows
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_can_edit_project(t.project_id)
    )
  ) with check (
    -- Validate the updated row
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and public.user_can_edit_project(t.project_id)
    )
  );
```

## Migration History
- `20251107120003` - Original consolidation (made policies admin-only - BROKEN)
- `20251107120010` - First fix attempt (removed, consolidated)
- `20251107120011` - Second fix attempt (removed, consolidated)
- `20251107120012` - Third fix attempt (kept but superseded)
- `20251107120013` - Alternative approach (removed, consolidated)
- `20251107120014` - **FINAL CLEAN FIX** (consolidates all fixes)

## Testing
After applying migration `20251107120014`, verify:
1. ✅ Can save a task with assignees
2. ✅ Can update a task and change assignees
3. ✅ Can remove all assignees from a task
4. ✅ Project members with edit permission can manage assignees
5. ✅ Non-members cannot manage assignees

## If Still Broken
If the issue persists after applying `20251107120014`, check:
1. Is the migration actually applied? Check with: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;`
2. Do the policies exist? Check with: `SELECT policyname FROM pg_policies WHERE tablename = 'task_assignees';`
3. Is the helper function working? Test with: `SELECT public.user_can_edit_project('project-id-here');`
4. Can the user actually edit the task? Verify project membership and permissions

## Rollback
If needed, restore original policies:
```sql
drop policy if exists "Users insert task assignees" on public.task_assignees;
drop policy if exists "Users update task assignees" on public.task_assignees;
drop policy if exists "Users delete task assignees" on public.task_assignees;
drop policy if exists "Users view task assignees" on public.task_assignees;

-- Restore admin-only policies
create policy "Admins manage task assignees" on public.task_assignees
  using (public.is_admin()) with check (public.is_admin());

-- Restore member view policy
create policy "Members view task assignees" on public.task_assignees
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and t.deleted_at is null
        and exists (
          select 1 from public.project_members pm
          where pm.project_id = t.project_id
            and pm.user_id = (select auth.uid())
            and pm.deleted_at is null
        )
    )
    and deleted_at is null
  );
```


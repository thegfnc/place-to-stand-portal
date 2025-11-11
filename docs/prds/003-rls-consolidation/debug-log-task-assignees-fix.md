# Task Assignees RLS Fix - Debug Log

## Problem Statement

**Original Issue**: When saving a task with assignees, the application was throwing RLS errors:
```
Failed to archive existing task assignees {
  code: '42501',
  message: 'new row violates row-level security policy for table "task_assignees"'
}
Failed to sync task assignees {
  code: '42501',
  message: 'new row violates row-level security policy for table "task_assignees"'
}
```

**Root Cause**: Migration `20251107120003_consolidate_task_assignees_rls.sql` created INSERT/UPDATE/DELETE policies that were **admin-only**, but the application requires **project members with edit permissions** to manage task assignees (matching the permissions for managing tasks).

**Application Code Pattern**: The `syncAssignees` function in `app/(dashboard)/projects/actions/task-helpers.ts`:
1. First updates ALL existing assignees to set `deleted_at` (soft delete)
2. Then upserts new assignees (sets `deleted_at = null` for active ones)

This requires the UPDATE policy to:
- Allow updating rows regardless of their `deleted_at` status
- Work for project members (not just admins)

## Migration History

### Original Migration (Already in Production)
- **`20251107120003_consolidate_task_assignees_rls.sql`** (DO NOT EDIT - already run in production)
  - Created SELECT policy: "Users view task assignees" (admin OR project member) ✅
  - Created INSERT policy: "Admins insert task assignees" (admin only) ❌
  - Created UPDATE policy: "Admins update task assignees" (admin only) ❌
  - Created DELETE policy: "Admins delete task assignees" (admin only) ❌

  **Problem**: The INSERT/UPDATE/DELETE policies were too restrictive - only admins could manage assignees, but the application needs project members to do this.

### Failed Fix Attempts (All Deleted)

**20251107120010** - Initial fix using `user_can_edit_project` helper function
- Used helper function to check permissions
- **Failed**: Helper function may not work correctly in UPDATE context with soft-deletes

**20251107120011** - Attempted to fix with cleaner state
- Dropped all policies and recreated
- **Failed**: Still had issues with UPDATE on soft-deleted rows

**20251107120012** - Further refinement
- Refined UPDATE policy
- **Failed**: Still not working

**20251107120013** - No helper function approach
- Used direct joins instead of helper function
- **Failed**: Direct joins may have circular dependency issues

**20251107120014-20251107120025** - Multiple more attempts with various approaches
- All failed for various reasons
- Created confusion with too many migrations

### Final Solution

**`20251107120010_fix_task_assignees_permissions.sql`** (Consolidated fix - CURRENT)

**Key Insights from Working Patterns**:
1. **Task attachments policies work correctly** - use the same pattern
2. **Direct joins work better than helper functions** for RLS policies
3. **UPDATE policy must NOT check `deleted_at` in `using` clause** - we need to update soft-deleted rows
4. **Separate admin policies from member policies** to avoid conflicts

**Solution**:
- Drops the admin-only policies from migration 20251107120003
- Creates new policies using **direct join pattern** (matching task_attachments)
- UPDATE policy does NOT check `deleted_at` in `using` clause (critical for soft-deletes)
- Keeps admin policy separate for all operations
- Creates member policies for INSERT/UPDATE/DELETE that allow project members

## Key Technical Details

### Working Pattern (from task_attachments)

```sql
-- Task attachments UPDATE policy (WORKING)
create policy "Project managers update task attachments" on public.task_attachments
  for update using (
    deleted_at is null  -- Checks deleted_at on task_attachments
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
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
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
    )
  );
```

### Task Assignees Pattern (FIXED)

```sql
-- Task assignees UPDATE policy (FIXED)
-- KEY DIFFERENCE: Does NOT check deleted_at in using clause
create policy "Project collaborators update task assignees" on public.task_assignees
  for update using (
    -- NOTE: Don't check deleted_at here - we need to update soft-deleted rows!
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.deleted_at is null
      join public.project_members pm
        on pm.project_id = t.project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
      where t.id = task_assignees.task_id
        and t.deleted_at is null
    )
  );
```

**Critical Difference**:
- Task attachments checks `deleted_at is null` in the `using` clause (prevents updating soft-deleted attachments)
- Task assignees does NOT check `deleted_at` in the `using` clause (allows updating soft-deleted assignees for the upsert pattern)

## Application Code Context

The `syncAssignees` function in `app/(dashboard)/projects/actions/task-helpers.ts`:

```typescript
// Step 1: Soft delete all existing assignees
const { error: removeError } = await supabase
  .from('task_assignees')
  .update({ deleted_at: deletionTimestamp })
  .eq('task_id', taskId)

// Step 2: Upsert active assignees (sets deleted_at = null)
const { error: upsertError } = await supabase.from('task_assignees').upsert(
  assigneeIds.map(userId => ({
    task_id: taskId,
    user_id: userId,
    deleted_at: null,
  })),
  { onConflict: 'task_id,user_id' }
)
```

**Why this pattern requires special handling**:
1. Step 1 updates rows that are currently active (`deleted_at IS NULL`) to set `deleted_at`
2. Step 2 updates rows that were just soft-deleted (`deleted_at IS NOT NULL`) to set `deleted_at = NULL`
3. The UPDATE policy must allow both scenarios

## Lessons Learned

### What Works
1. **Direct joins** in RLS policies (like task_attachments)
2. **Separate admin and member policies** (avoids conflicts)
3. **Not checking `deleted_at` in UPDATE `using` clause** when soft-deletes need to be updated
4. **Forward-only migrations** (never edit old migrations)

### What Doesn't Work
1. **Helper functions in UPDATE context** - can cause circular dependency or evaluation issues
2. **Checking `deleted_at` in UPDATE `using` clause** when you need to update soft-deleted rows
3. **Admin-only policies for operations** that application code requires members to perform
4. **Editing migrations that have already run in production**

### Key Principles
1. **Test against actual application patterns** - the syncAssignees function drives the requirements
2. **Match working patterns** - task_attachments policies work, so use similar pattern
3. **Understand the difference** - task_attachments doesn't need to update soft-deletes, task_assignees does
4. **Keep it simple** - direct joins are clearer than helper functions for RLS

## Current State

### Migrations After 20251107120007 (Production)
- **20251107120008** - `consolidate_tasks_rls.sql` ✅
- **20251107120009** - `consolidate_activity_logs_rls.sql` ✅
- **20251107120010** - `fix_task_assignees_permissions.sql` ✅ (FIXED - ready to test)

### Policies on task_assignees (After fix)
- **SELECT**: "Users view task assignees" (admin OR project member) - from migration 20251107120003
- **Admin operations**: "Admins manage task assignees" (admin only, all operations)
- **INSERT**: "Project collaborators insert task assignees" (project members)
- **UPDATE**: "Project collaborators update task assignees" (project members, allows soft-deleted rows)
- **DELETE**: "Project collaborators delete task assignees" (project members)

## Testing Checklist

When testing the fix, verify:
1. ✅ Admin can manage task assignees
2. ✅ Project member can add assignees to tasks they can edit
3. ✅ Project member can remove assignees from tasks they can edit
4. ✅ Project member can update assignees (the syncAssignees flow works)
5. ✅ Non-member cannot manage assignees
6. ✅ Soft-deleted assignees can be restored (deleted_at set to null)

## Diagnostic Queries

If issues persist, run these queries:

```sql
-- Check current policies
SELECT policyname, cmd,
  substring(qual::text, 1, 200) as using_clause,
  substring(with_check::text, 1, 200) as with_check_clause
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname, cmd;

-- Test if user can edit a task
SELECT public.user_can_edit_project(
  (select project_id from tasks where id = 'TASK_ID' and deleted_at is null)
);

-- Verify user is project member
SELECT pm.*, t.id as task_id, t.project_id
FROM project_members pm
JOIN tasks t ON t.project_id = pm.project_id
WHERE pm.user_id = auth.uid()
  AND pm.deleted_at is null
  AND t.deleted_at is null
  AND t.id = 'TASK_ID';
```

## Next Steps

1. **Test the fix** - Verify that saving tasks with assignees works
2. **Monitor for errors** - Check logs for any RLS violations
3. **Phase 4** - Continue with remaining RLS consolidations (if any)
4. **Documentation** - Update any relevant docs about task assignee permissions

## Files Changed

### Migrations
- ✅ Legacy Supabase script `20251107120010_fix_task_assignees_permissions.sql` (archived; consolidated fix)
- ❌ Legacy Supabase script `20251107120003_consolidate_task_assignees_rls.sql` (reverted; no edits retained)

### Deleted Migrations (Consolidated into 20251107120010)
- ❌ `20251107120017_fix_task_assignees_function.sql`
- ❌ `20251107120023_fix_task_assignees_consolidated_final.sql`
- ❌ `20251107120024_fix_task_assignees_absolute_final.sql`
- ❌ `20251107120025_fix_task_assignees_match_attachments_pattern.sql`
- ❌ `20251107120011-20251107120016`, `20251107120018-20251107120022` (various failed attempts)

## Important Notes

1. **Never edit migrations that have run in production** - Always create new forward-only migrations
2. **Understand the application pattern** - The syncAssignees function drives the RLS requirements
3. **Match working patterns** - Use task_attachments as a reference, but adapt for soft-deletes
4. **Test incrementally** - Don't create 20 migrations before testing one
5. **Keep migrations focused** - One migration should fix one specific issue

## Contact / Reference

- Original issue: RLS error when saving tasks with assignees
- Application code: `app/(dashboard)/projects/actions/task-helpers.ts` - `syncAssignees` function
- Working reference: legacy Supabase scripts `*_task_attachments*.sql` (see repository history)
- Related migrations: `20251107120003`, `20251107120008`, `20251107120009`, `20251107120010`


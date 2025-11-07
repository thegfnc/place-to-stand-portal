# Task Assignees RLS Debug Guide

## Current Status
Migration `20251107120024_fix_task_assignees_absolute_final.sql` has been applied. This should work.

## If Still Broken - Diagnostic Steps

### 1. Check if function exists and works
```sql
-- Test the function directly
SELECT public.user_can_edit_task('your-task-id-here');
-- Should return true if user can edit, false otherwise

-- Check if function exists
SELECT proname, prosecdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'user_can_edit_task';
-- prosecdef should be true (security definer)
```

### 2. Check current policies
```sql
SELECT policyname, cmd,
  substring(qual::text, 1, 200) as using_clause,
  substring(with_check::text, 1, 200) as with_check_clause
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname, cmd;
```

### 3. Test UPDATE manually
```sql
-- Try updating a task_assignee row manually as the user
UPDATE task_assignees
SET deleted_at = now()
WHERE task_id = 'your-task-id'
LIMIT 1;
-- This should work if policies are correct
```

### 4. Check user permissions
```sql
-- Verify user is project member
SELECT pm.*, t.id as task_id, t.project_id
FROM project_members pm
JOIN tasks t ON t.project_id = pm.project_id
WHERE pm.user_id = auth.uid()
  AND pm.deleted_at is null
  AND t.deleted_at is null
  AND t.id = 'your-task-id';
-- Should return a row if user is a member
```

## Possible Issues

1. **Function not working**: The `user_can_edit_task` function might not be returning true
2. **Transaction context**: Maybe the task was just created and visibility is an issue
3. **Bulk update issue**: Maybe updating multiple rows at once causes policy evaluation issues
4. **RLS on tasks table**: Maybe the tasks table RLS is preventing the function from seeing the task

## Nuclear Option

If nothing works, we can temporarily disable RLS on task_assignees to verify the issue is RLS-related:
```sql
-- TEMPORARY - FOR TESTING ONLY
ALTER TABLE task_assignees DISABLE ROW LEVEL SECURITY;
-- Test if it works now
-- Then re-enable and fix policies
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
```


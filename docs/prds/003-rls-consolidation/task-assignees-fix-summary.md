# Task Assignees RLS Fix - Quick Summary

## The Problem
Migration `20251107120003` created admin-only INSERT/UPDATE/DELETE policies, but app needs project members to manage assignees.

## The Solution
Migration `20251107120010` fixes it by:
1. Dropping admin-only policies from `20251107120003`
2. Creating member policies using direct joins (like task_attachments)
3. UPDATE policy does NOT check `deleted_at` in `using` clause (allows updating soft-deleted rows)

## Key Difference
- **Task attachments**: Checks `deleted_at is null` in UPDATE `using` clause
- **Task assignees**: Does NOT check `deleted_at` in UPDATE `using` clause (required for upsert pattern)

## Why It Matters
The `syncAssignees` function:
1. Updates all assignees to set `deleted_at` (soft delete)
2. Upserts active assignees (sets `deleted_at = null`)

This requires updating rows regardless of their `deleted_at` status.

## Current State
- ✅ Migration `20251107120010` created and ready to test
- ✅ Old migration `20251107120003` reverted (no edits)
- ✅ All failed attempts consolidated/deleted

## Test
Save a task with assignees - should work without RLS errors.

## See Also
- Full debug log: `debug-log-task-assignees-fix.md`
- Migration: legacy Supabase script `20251107120010_fix_task_assignees_permissions.sql` (see repository history)
- Application code: `app/(dashboard)/projects/actions/task-helpers.ts` - `syncAssignees`

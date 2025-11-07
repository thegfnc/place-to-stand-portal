# Phase 3 RLS Consolidation - Summary

## Status: ✅ Complete

All 2 Phase 3 migrations have been created and are ready for testing and deployment.

## Migrations Created

### 1. `20251107120008_consolidate_tasks_rls.sql`
- **Table**: `tasks`
- **Change**: Consolidated all operations (SELECT, INSERT, UPDATE, DELETE)
- **Policies**: 2 → 4 (but eliminates duplicates for all operations)
  - Before:
    - "Admins full access to tasks" (all ops)
    - "Project members manage tasks" (all ops)
  - After:
    - "Users view tasks" (select - consolidated)
    - "Users create tasks" (insert - consolidated)
    - "Users update tasks" (update - consolidated)
    - "Users delete tasks" (delete - consolidated)

### 2. `20251107120009_consolidate_activity_logs_rls.sql`
- **Table**: `activity_logs`
- **Change**: Consolidated SELECT, INSERT, and UPDATE operations
- **Policies**: 4 → 4 (but eliminates duplicates for SELECT, INSERT, UPDATE)
  - Before:
    - "Admins manage activity logs" (all ops)
    - "Users insert their own activity logs" (insert)
    - "Users view accessible activity logs" (select)
    - "Admins restore or archive activity logs" (update)
  - After:
    - "Users view activity logs" (select - consolidated)
    - "Users insert activity logs" (insert - consolidated)
    - "Admins update activity logs" (update - consolidated)
    - "Admins delete activity logs" (delete - admin only, no duplicate)

## Pattern Applied

### Tasks Table
1. **Consolidate SELECT**: Admin OR project member (via helper function)
2. **Consolidate INSERT**: Admin OR project member with edit permission
3. **Consolidate UPDATE**: Admin OR project member with edit permission
4. **Consolidate DELETE**: Admin OR project member with edit permission

### Activity Logs Table
1. **Consolidate SELECT**: Admin OR (user viewing own logs OR project member OR client member)
2. **Consolidate INSERT**: Admin OR user inserting own logs
3. **Consolidate UPDATE**: Admin only (for restore/archive operations)
4. **Separate DELETE**: Admin only (no duplicate, so separate policy)

## Key Features

### Tasks Table
- **Uses helper functions**: Leverages `user_is_project_member` and `user_can_edit_project` for cleaner policies
- **Permission-based access**: Different permissions for view vs create/update/delete
- **All operations consolidated**: Eliminates duplicates for all 4 operations

### Activity Logs Table
- **Complex access patterns**: Multiple ways to access logs (own logs, project logs, client logs)
- **Actor-based access**: Users can insert/view their own activity logs
- **Context-based access**: Project and client members can view relevant logs
- **Admin-only modifications**: Only admins can update/delete logs

## Testing Checklist

For each migration, verify:

### Tasks Table
- [ ] Admin can SELECT all tasks
- [ ] Project member can SELECT tasks in their projects
- [ ] Unauthorized user cannot SELECT tasks
- [ ] Admin can CREATE/UPDATE/DELETE tasks
- [ ] Project member with edit permission can CREATE/UPDATE/DELETE tasks
- [ ] Project member without edit permission cannot CREATE/UPDATE/DELETE tasks (should be blocked)
- [ ] Soft-deleted tasks are filtered correctly
- [ ] Query performance is maintained or improved

### Activity Logs Table
- [ ] Admin can SELECT all activity logs
- [ ] User can SELECT their own activity logs
- [ ] Project member can SELECT logs for their projects
- [ ] Client member can SELECT logs for their clients
- [ ] Unauthorized user cannot SELECT activity logs
- [ ] Admin can INSERT activity logs
- [ ] User can INSERT their own activity logs
- [ ] User cannot INSERT logs for other users (should be blocked)
- [ ] Admin can UPDATE activity logs (restore/archive)
- [ ] User cannot UPDATE activity logs (should be blocked)
- [ ] Admin can DELETE activity logs
- [ ] User cannot DELETE activity logs (should be blocked)
- [ ] Soft-deleted logs are filtered correctly
- [ ] Query performance is maintained or improved

## Deployment Strategy

### Recommended Order

1. **Test locally**:
   ```bash
   supabase db reset
   # Verify all tests pass
   ```

2. **Deploy to staging** (one migration at a time):
   - Deploy migration 1 (tasks)
   - Monitor for 24-48 hours
   - Deploy migration 2 (activity_logs)
   - Monitor for 24-48 hours

3. **Deploy to production** (after staging validation):
   - Deploy during low-traffic window
   - Monitor closely for first few hours
   - Have rollback scripts ready

### Rollback Scripts

Each migration includes rollback instructions in comments. If issues arise:

1. Drop the new consolidated policies
2. Restore the original policies from the previous migration
3. Investigate and fix the issue
4. Retry the consolidation

## Expected Impact

- **Supabase warnings**: Should eliminate ~7 duplicate policy warnings (4 for tasks, 3 for activity_logs)
- **Performance**: Significant improvement in query performance (fewer policy evaluations for all operations)
- **Security**: No change (same access controls maintained)
- **Risk**: Medium (higher complexity tables with multiple access patterns)

## Complexity Notes

### Tasks Table
The tasks table consolidation is complex because:
- It consolidates all 4 operations (SELECT, INSERT, UPDATE, DELETE)
- Different permissions for view (project membership) vs modify (edit permission)
- Uses helper functions for cleaner policy logic
- Critical table with high query volume

### Activity Logs Table
The activity_logs table consolidation is complex because:
- Multiple access patterns (own logs, project logs, client logs)
- Actor-based access control (users can only insert their own logs)
- Context-based access (project/client membership for viewing)
- Admin-only modifications (update/delete restricted to admins)

### Helper Functions
Both migrations rely on helper functions:
- Tasks: `user_is_project_member`, `user_can_edit_project`
- Activity Logs: Direct membership checks (project_members, client_members)

These functions/checks are optimized to avoid performance issues.

## Performance Considerations

### Tasks Table
- High query volume table - consolidation should provide noticeable performance improvement
- Helper functions are `security definer` and optimized
- Policy conditions are evaluated efficiently

### Activity Logs Table
- Moderate query volume - consolidation should improve performance
- Multiple EXISTS subqueries - ensure indexes are present on:
  - `project_members(project_id, user_id)` where `deleted_at is null`
  - `client_members(client_id, user_id)` where `deleted_at is null`
  - `activity_logs(target_project_id, target_client_id, actor_id, deleted_at)`

## Next Steps

1. ✅ All Phase 3 migrations created
2. ⏳ Test migrations locally
3. ⏳ Deploy to staging (one at a time)
4. ⏳ Monitor and validate
5. ⏳ Deploy to production (after staging validation)
6. ⏳ Move to Phase 4 (task_comments, task_attachments, time_logs, time_log_tasks)

## Notes

- All migrations are idempotent (can be run multiple times safely)
- All migrations include rollback instructions
- All migrations maintain the same access controls
- Helper functions from previous migrations are reused appropriately
- Tasks table is critical - test thoroughly before production deployment
- Activity logs table has complex access patterns - verify all scenarios work correctly


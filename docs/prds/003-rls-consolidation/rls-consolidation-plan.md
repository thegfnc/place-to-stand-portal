# RLS Policy Consolidation Plan

## Problem Statement

Supabase is flagging 140 instances where multiple permissive RLS policies exist on the same table for the same role and action (e.g., INSERT, SELECT, UPDATE). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.

## Root Cause Analysis

When multiple permissive policies exist for the same operation (e.g., SELECT), PostgreSQL evaluates them with OR logic:
- Policy 1: `admin_check()`
- Policy 2: `member_check()`
- Result: `admin_check() OR member_check()`

This requires evaluating both checks even when the first one might be sufficient.

## Solution Strategy

Consolidate multiple permissive policies into single policies using OR logic within the policy expression:

```sql
-- Before (2 policies):
create policy "Admins manage X" on table_x using (is_admin()) with check (is_admin());
create policy "Members view X" on table_x for select using (member_check());

-- After (1 policy):
create policy "Users access X" on table_x for select using (
  is_admin() OR member_check()
);
```

## Incremental Consolidation Approach

We'll consolidate policies incrementally, table by table, to minimize risk:

1. **Start with simplest tables** (fewer dependencies, less critical)
2. **Test thoroughly** after each consolidation
3. **Use feature flags** if available to rollback quickly
4. **Monitor performance** after each change

## Priority Order

### Phase 1: Low-Risk, Simple Tables (Start Here)
These tables have straightforward policies and minimal dependencies:

1. **activity_overview_cache** - 4 separate policies for same user operations
2. **users** - Simple self-view + admin policies
3. **client_members** - Simple membership policies

### Phase 2: Medium Complexity
Tables with more complex logic but well-defined boundaries:

4. **activity_logs** - Multiple policies for different access patterns
5. **task_assignees** - Admin + member view policies
6. **project_members** - Admin + member view policies

### Phase 3: Higher Complexity
Tables with complex business logic and multiple access patterns:

7. **clients** - Admin + member read policies
8. **projects** - Admin + member read + member update policies
9. **tasks** - Admin + member manage policies
10. **hour_blocks** - Admin + member view policies

### Phase 4: Most Complex
Tables with multiple operations and complex permission checks:

11. **task_comments** - Admin + multiple member policies (read, create, update)
12. **task_attachments** - Admin + multiple member policies (read, create, update)
13. **time_logs** - Admin + multiple policies (read, insert, update)
14. **time_log_tasks** - Admin + author + collaborator policies

## Testing Strategy

For each consolidation:

1. **Create migration file** with consolidated policy
2. **Test in local/dev environment** first
3. **Verify all access patterns** still work:
   - Admin can perform all operations
   - Members can perform expected operations
   - Unauthorized users are blocked
4. **Check query performance** (EXPLAIN ANALYZE)
5. **Deploy to staging**
6. **Monitor for 24-48 hours**
7. **Deploy to production**

## Rollback Plan

Each migration should:
- Drop old policies before creating new ones
- Be idempotent (can be run multiple times safely)
- Include rollback instructions in comments

If issues arise:
1. Revert the migration immediately
2. Restore previous policies
3. Investigate the root cause
4. Fix and retry

## Success Metrics

- Reduce number of permissive policies from 140 to < 20
- Maintain all existing access controls
- Improve query performance (reduce policy evaluation overhead)
- Zero security regressions


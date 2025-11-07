# RLS Policy Consolidation Project

## Problem

Supabase is flagging 140 issues where multiple permissive RLS policies exist on the same table for the same role and action. Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.

## Solution

Consolidate multiple permissive policies into single policies using OR logic within the policy expression.

## Documentation

1. **`rls-consolidation-plan.md`** - High-level strategy and approach
2. **`rls-policy-analysis.md`** - Detailed analysis of current policies and duplicates
3. **`rls-consolidation-execution-guide.md`** - Step-by-step execution instructions

## Example Migrations

Example migration files are in `supabase/migrations/EXAMPLE_*.sql`:

- `EXAMPLE_consolidate_client_members_rls.sql` - Simplest case
- `EXAMPLE_consolidate_users_rls.sql` - Simple case
- `EXAMPLE_consolidate_clients_rls.sql` - Medium complexity
- `EXAMPLE_consolidate_tasks_rls.sql` - Higher complexity

## Quick Start

1. **Read the execution guide**: `docs/rls-consolidation-execution-guide.md`
2. **Start with Phase 1**: Begin with simplest tables (`client_members`, `users`)
3. **Test thoroughly**: Test each consolidation before moving to the next
4. **Deploy incrementally**: Don't consolidate all at once

## Recommended Order

### Phase 1: Simple Tables (Start Here)

1. `client_members` - 1 duplicate
2. `users` - 1 duplicate
3. `task_assignees` - 1 duplicate
4. `project_members` - 1 duplicate
5. `hour_blocks` - 1 duplicate

### Phase 2: Medium Complexity

6. `clients` - 1 duplicate
7. `projects` - 2 duplicates

### Phase 3: Higher Complexity

8. `tasks` - 4 duplicates
9. `activity_logs` - 3 duplicates

### Phase 4: Most Complex

10. `task_comments` - 3 duplicates
11. `task_attachments` - 3 duplicates
12. `time_logs` - 3 duplicates
13. `time_log_tasks` - 5 duplicates

## Key Principles

1. **Incremental approach**: One table at a time
2. **Test thoroughly**: Verify all access patterns after each change
3. **Monitor closely**: Watch for performance and security issues
4. **Have rollback ready**: Be prepared to revert if issues arise

## Status

- [ ] Phase 1: Simple Tables
- [ ] Phase 2: Medium Complexity
- [ ] Phase 3: Higher Complexity
- [ ] Phase 4: Most Complex

## Notes

- Previous attempt to fix all at once broke everything - hence the incremental approach
- Each consolidation should be tested in dev/staging before production
- Monitor for 24-48 hours after each production deployment

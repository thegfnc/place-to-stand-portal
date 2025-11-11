# RLS Policy Consolidation - Execution Guide

## Overview

This guide provides step-by-step instructions for consolidating multiple permissive RLS policies to improve query performance and resolve Supabase warnings.

## Prerequisites

1. **Backup your database** before starting
2. **Test in local/dev environment** first
3. **Have rollback plan** ready for each migration
4. **Monitor application** after each deployment

## Step-by-Step Process

### Phase 1: Preparation

1. **Review current policies**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT
     schemaname,
     tablename,
     policyname,
     permissive,
     roles,
     cmd,
     qual,
     with_check
   FROM pg_policies
   WHERE schemaname = 'public'
     AND permissive = 'PERMISSIVE'
   ORDER BY tablename, cmd, policyname;
   ```

2. **Document current behavior**: Note what each policy does before changing it

3. **Create test cases**: Write down specific scenarios to test after consolidation

### Phase 2: Incremental Consolidation

For each table, follow these steps:

#### Step 1: Create Migration File

1. Generate timestamp: `date +"%Y%m%d%H%M%S"`
2. Create migration file: `YYYYMMDDHHMMSS_consolidate_TABLE_rls.sql`
3. Copy from the legacy example scripts `EXAMPLE_*.sql` (see repository history)

#### Step 2: Write Consolidation Logic

**Pattern for SELECT operations:**
```sql
-- Drop old policies
drop policy if exists "Old policy 1" on public.table_name;
drop policy if exists "Old policy 2" on public.table_name;

-- Create consolidated policy
create policy "Users view table_name" on public.table_name
  for select using (
    deleted_at is null
    and (
      public.is_admin()
      OR member_condition()
    )
  );
```

**Pattern for INSERT/UPDATE/DELETE:**
```sql
-- If admin-only modifications
create policy "Admins manage table_name" on public.table_name
  for insert, update, delete using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

-- If members can also modify
create policy "Users manage table_name" on public.table_name
  for insert, update, delete using (
    public.is_admin()
    OR member_modify_condition()
  ) with check (
    public.is_admin()
    OR member_modify_condition()
  );
```

#### Step 3: Test Locally

1. **Apply migration**:
   ```bash
   supabase db reset  # in local dev
   # or
   supabase migration up
   ```

2. **Verify policies**:
   ```sql
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'your_table'
   ORDER BY cmd, policyname;
   ```

3. **Test access patterns**:
   - Admin user: Can perform all expected operations
   - Member user: Can perform expected operations
   - Unauthorized user: Correctly blocked

4. **Check query plans**:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM your_table;
   ```

#### Step 4: Deploy to Staging

1. **Apply migration** to staging environment
2. **Run test suite** if available
3. **Monitor for 24-48 hours**:
   - Check error logs
   - Monitor query performance
   - Verify user reports

#### Step 5: Deploy to Production

1. **Apply migration** during low-traffic window
2. **Monitor closely** for first few hours
3. **Have rollback ready**:
   ```sql
   -- Rollback script (keep in separate file)
   drop policy if exists "New consolidated policy" on public.table_name;
   -- Restore original policies from previous migration
   ```

## Recommended Order

Execute consolidations in this order (simplest to most complex):

### ✅ Phase 1: Simple Tables (Week 1)
1. `client_members` - 1 duplicate (SELECT)
2. `users` - 1 duplicate (SELECT)
3. `task_assignees` - 1 duplicate (SELECT)
4. `project_members` - 1 duplicate (SELECT)
5. `hour_blocks` - 1 duplicate (SELECT)

### ✅ Phase 2: Medium Complexity (Week 2)
6. `clients` - 1 duplicate (SELECT)
7. `projects` - 2 duplicates (SELECT, UPDATE)

### ✅ Phase 3: Higher Complexity (Week 3)
8. `tasks` - 4 duplicates (SELECT, INSERT, UPDATE, DELETE)
9. `activity_logs` - 3 duplicates (SELECT, INSERT, UPDATE)

### ✅ Phase 4: Most Complex (Week 4)
10. `task_comments` - 3 duplicates (SELECT, INSERT, UPDATE)
11. `task_attachments` - 3 duplicates (SELECT, INSERT, UPDATE)
12. `time_logs` - 3 duplicates (SELECT, INSERT, UPDATE)
13. `time_log_tasks` - 5 duplicates (SELECT x2, INSERT, UPDATE, DELETE)

## Testing Checklist

For each consolidation, verify:

- [ ] Admin can SELECT records
- [ ] Admin can INSERT records (if applicable)
- [ ] Admin can UPDATE records (if applicable)
- [ ] Admin can DELETE records (if applicable)
- [ ] Member can SELECT records (where allowed)
- [ ] Member can INSERT records (where allowed)
- [ ] Member can UPDATE records (where allowed)
- [ ] Member can DELETE records (where allowed)
- [ ] Unauthorized user is blocked from all operations
- [ ] Soft-deleted records are filtered correctly
- [ ] Query performance is maintained or improved
- [ ] No new errors in application logs

## Common Patterns

### Pattern 1: Admin + Member Read Access
```sql
-- Before: 2 policies
-- After: 1 policy
create policy "Users view table" on public.table
  for select using (
    deleted_at is null
    and (public.is_admin() OR member_read_condition())
  );
```

### Pattern 2: Admin + Member Modify Access
```sql
-- Before: 2 policies (admin for all, member for specific op)
-- After: 1 policy per operation
create policy "Users modify table" on public.table
  for insert, update, delete using (
    public.is_admin() OR member_modify_condition()
  ) with check (
    public.is_admin() OR member_modify_condition()
  );
```

### Pattern 3: Admin + Author Modify Access
```sql
-- Before: 2 policies (admin for all, author for update)
-- After: 1 policy
create policy "Users update table" on public.table
  for update using (
    deleted_at is null
    and (
      public.is_admin()
      OR (author_id = (select auth.uid()) AND author_modify_condition())
    )
  ) with check (
    public.is_admin()
    OR (author_id = (select auth.uid()) AND author_modify_condition())
  );
```

## Rollback Procedure

If issues arise:

1. **Immediately revert migration**:
   ```sql
   -- Drop new policies
   drop policy if exists "New policy name" on public.table_name;

   -- Restore original policies (from previous migration or backup)
   -- Copy policies from migration file before consolidation
   ```

2. **Investigate root cause**:
   - Check query logs
   - Review policy conditions
   - Test specific failing scenarios

3. **Fix and retry**:
   - Update migration file
   - Test thoroughly
   - Deploy again

## Success Metrics

- ✅ All Supabase warnings resolved (140 → 0)
- ✅ All access controls maintained
- ✅ Query performance improved or maintained
- ✅ Zero security regressions
- ✅ Zero production incidents

## Notes

- **Don't rush**: Take time between each consolidation
- **Test thoroughly**: Better to be slow and correct
- **Monitor closely**: Watch for any unexpected behavior
- **Document changes**: Update this guide with lessons learned
- **Get feedback**: Have team review before production deployment

## Questions or Issues?

- Check example migrations from the legacy `EXAMPLE_*.sql` scripts (repository history)
- Review analysis in `docs/rls-policy-analysis.md`
- Consult Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security


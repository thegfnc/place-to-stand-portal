# RLS Policy Duplicate Analysis

## Current Policy Structure

Based on migration files, here are the tables with multiple permissive policies that need consolidation:

### Pattern Identified

Most tables follow this pattern:
1. **Admin policy**: Uses `using` and `with check` clauses which apply to ALL operations (SELECT, INSERT, UPDATE, DELETE)
2. **Member policies**: Operation-specific policies (e.g., `for select`, `for update`)

This creates multiple permissive policies for the same operation, which Supabase flags.

### Tables Needing Consolidation

#### 1. `users` table
- **"Users can view themselves"** - `for select`
- **"Admins manage users"** - `using` + `with check` (applies to all operations)

**Consolidation needed**: SELECT operation has 2 policies

#### 2. `clients` table
- **"Admins full access to clients"** - `using` + `with check` (all operations)
- **"Members read clients"** - `for select`

**Consolidation needed**: SELECT operation has 2 policies

#### 3. `projects` table
- **"Admins full access to projects"** - `using` + `with check` (all operations)
- **"Members read projects"** - `for select`
- **"Members update their projects"** - `for update`

**Consolidation needed**:
- SELECT operation has 2 policies
- UPDATE operation has 2 policies (admin policy + member policy)

#### 4. `project_members` table
- **"Admins manage project members"** - `using` + `with check` (all operations)
- **"Members view project members"** - `for select`

**Consolidation needed**: SELECT operation has 2 policies

#### 5. `tasks` table
- **"Admins full access to tasks"** - `using` + `with check` (all operations)
- **"Project members manage tasks"** - `using` + `with check` (all operations)

**Consolidation needed**: ALL operations have 2 policies (SELECT, INSERT, UPDATE, DELETE)

#### 6. `task_assignees` table
- **"Admins manage task assignees"** - `using` + `with check` (all operations)
- **"Members view task assignees"** - `for select`

**Consolidation needed**: SELECT operation has 2 policies

#### 7. `hour_blocks` table
- **"Admins manage hour blocks"** - `using` + `with check` (all operations)
- **"Members view hour blocks"** - `for select`

**Consolidation needed**: SELECT operation has 2 policies

#### 8. `client_members` table
- **"Admins manage client members"** - `using` + `with check` (all operations)
- **"Members view their client assignments"** - `for select`

**Consolidation needed**: SELECT operation has 2 policies

#### 9. `task_comments` table
- **"Admins manage task comments"** - `using` + `with check` (all operations)
- **"Project collaborators read task comments"** - `for select`
- **"Project collaborators create task comments"** - `for insert`
- **"Authors update their task comments"** - `for update`

**Consolidation needed**:
- SELECT operation has 2 policies
- INSERT operation has 2 policies
- UPDATE operation has 2 policies

#### 10. `task_attachments` table
- **"Admins manage task attachments"** - `using` + `with check` (all operations)
- **"Project collaborators read task attachments"** - `for select`
- **"Project collaborators create task attachments"** - `for insert`
- **"Project managers update task attachments"** - `for update`

**Consolidation needed**:
- SELECT operation has 2 policies
- INSERT operation has 2 policies
- UPDATE operation has 2 policies

#### 11. `time_logs` table
- **"Admins manage time logs"** - `using` + `with check` (all operations)
- **"Project collaborators read time logs"** - `for select`
- **"Admins log time on assigned projects"** - `for insert`
- **"Authors update their time logs"** - `for update`

**Consolidation needed**:
- SELECT operation has 2 policies
- INSERT operation has 2 policies (admin policy + admin insert policy)
- UPDATE operation has 2 policies

#### 12. `time_log_tasks` table
- **"Admins manage time log tasks"** - `for all` (all operations)
- **"Authors manage their time log tasks"** - `for all` (all operations)
- **"Project collaborators read time log tasks"** - `for select`

**Consolidation needed**:
- SELECT operation has 3 policies
- INSERT/UPDATE/DELETE operations have 2 policies (admin + author)

#### 13. `activity_logs` table
- **"Admins manage activity logs"** - `using` + `with check` (all operations)
- **"Users insert their own activity logs"** - `for insert`
- **"Users view accessible activity logs"** - `for select`
- **"Admins restore or archive activity logs"** - `for update`

**Consolidation needed**:
- SELECT operation has 2 policies
- INSERT operation has 2 policies
- UPDATE operation has 2 policies

#### 14. `activity_overview_cache` table
- **"Users can view their cached activity overview"** - `for select`
- **"Users can insert their cached activity overview"** - `for insert`
- **"Users can update their cached activity overview"** - `for update`
- **"Users can delete their cached activity overview"** - `for delete`

**Consolidation needed**: NONE - these are all different operations, no duplicates

## Total Count

If we count each duplicate:
- users: 1 duplicate (SELECT)
- clients: 1 duplicate (SELECT)
- projects: 2 duplicates (SELECT, UPDATE)
- project_members: 1 duplicate (SELECT)
- tasks: 4 duplicates (SELECT, INSERT, UPDATE, DELETE)
- task_assignees: 1 duplicate (SELECT)
- hour_blocks: 1 duplicate (SELECT)
- client_members: 1 duplicate (SELECT)
- task_comments: 3 duplicates (SELECT, INSERT, UPDATE)
- task_attachments: 3 duplicates (SELECT, INSERT, UPDATE)
- time_logs: 3 duplicates (SELECT, INSERT, UPDATE)
- time_log_tasks: 5 duplicates (SELECT x2, INSERT, UPDATE, DELETE)
- activity_logs: 3 duplicates (SELECT, INSERT, UPDATE)

**Total: ~28 duplicate policy pairs**

However, Supabase may be counting each policy that overlaps, so if a policy with `using` + `with check` overlaps with 4 operation-specific policies, that could be counted as 4 issues.

## Consolidation Strategy

For each table, we need to:

1. **For SELECT operations**: Combine admin check OR member check into single policy
2. **For INSERT operations**: Combine admin check OR member check into single policy
3. **For UPDATE operations**: Combine admin check OR member check into single policy
4. **For DELETE operations**: Combine admin check OR member check into single policy

### Example Consolidation Pattern

```sql
-- Before (2 policies for SELECT):
create policy "Admins full access" on table_x using (is_admin()) with check (is_admin());
create policy "Members read" on table_x for select using (member_check());

-- After (1 policy for SELECT):
drop policy if exists "Admins full access" on table_x;
drop policy if exists "Members read" on table_x;

create policy "Users access table_x" on table_x for select using (
  is_admin() OR member_check()
);

-- Keep separate policies for other operations if needed, but consolidate duplicates
create policy "Admins manage table_x" on table_x for insert, update, delete using (
  is_admin()
) with check (is_admin());
```


-- Performance optimization: Add indexes for unindexed foreign keys
-- Based on Supabase performance advisor recommendations

-- Activity logs: actor_id foreign key
create index if not exists idx_activity_logs_actor
  on public.activity_logs (actor_id)
  where deleted_at is null;

-- Clients: created_by foreign key
create index if not exists idx_clients_created_by
  on public.clients (created_by)
  where deleted_at is null;

-- Hour blocks: created_by foreign key
create index if not exists idx_hour_blocks_created_by
  on public.hour_blocks (created_by)
  where deleted_at is null;

-- Projects: created_by foreign key
create index if not exists idx_projects_created_by
  on public.projects (created_by)
  where deleted_at is null;

-- Task attachments: uploaded_by foreign key
create index if not exists idx_task_attachments_uploaded_by
  on public.task_attachments (uploaded_by)
  where deleted_at is null;

-- Task comments: author_id foreign key
create index if not exists idx_task_comments_author
  on public.task_comments (author_id)
  where deleted_at is null;

-- Tasks: created_by foreign key
create index if not exists idx_tasks_created_by
  on public.tasks (created_by)
  where deleted_at is null;

-- Tasks: updated_by foreign key
create index if not exists idx_tasks_updated_by
  on public.tasks (updated_by)
  where deleted_at is null;

-- Remove unused indexes (as identified by Supabase performance advisor)
-- Note: These indexes have not been used according to query statistics.
-- We are being conservative and only removing indexes that are:
-- 1. Not on foreign key columns (FK indexes help with cascade operations)
-- 2. Clearly not needed for common query patterns
--
-- Indexes on foreign keys (idx_hour_blocks_client, idx_time_logs_user,
-- idx_time_log_tasks_time_log, idx_time_log_tasks_task) are kept even if unused
-- as they support foreign key operations and may be needed for future queries.

-- Remove unused deleted_at indexes (if not used in WHERE clauses)
drop index if exists public.idx_clients_deleted_at;
drop index if exists public.idx_projects_deleted_at;

-- Remove unused composite index (may not be needed if queries don't filter by accepted_at)
drop index if exists public.idx_tasks_project_accepted;

-- Remove unused cache expiration index (if no cleanup job uses it)
drop index if exists public.activity_overview_cache_expires_at_idx;


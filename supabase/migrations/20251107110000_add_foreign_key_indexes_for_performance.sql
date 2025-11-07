-- Add indexes for foreign key columns to improve database performance
-- These indexes are required for optimal foreign key constraint operations,
-- JOIN performance, and CASCADE operations, even if not directly used in queries.
-- Based on Supabase performance advisor recommendations.

-- Activity logs: actor_id foreign key
create index if not exists idx_activity_logs_actor_id
  on public.activity_logs (actor_id)
  where deleted_at is null;

-- Clients: created_by foreign key
create index if not exists idx_clients_created_by
  on public.clients (created_by)
  where deleted_at is null;

-- Hour blocks: client_id foreign key
create index if not exists idx_hour_blocks_client_id
  on public.hour_blocks (client_id)
  where deleted_at is null;

-- Hour blocks: created_by foreign key
create index if not exists idx_hour_blocks_created_by
  on public.hour_blocks (created_by)
  where deleted_at is null;

-- Task attachments: uploaded_by foreign key
create index if not exists idx_task_attachments_uploaded_by
  on public.task_attachments (uploaded_by)
  where deleted_at is null;

-- Task comments: author_id foreign key
create index if not exists idx_task_comments_author_id
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

-- Time log tasks: task_id foreign key
create index if not exists idx_time_log_tasks_task_id
  on public.time_log_tasks (task_id)
  where deleted_at is null;

-- Time logs: user_id foreign key
create index if not exists idx_time_logs_user_id
  on public.time_logs (user_id)
  where deleted_at is null;


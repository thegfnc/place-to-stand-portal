-- Remove unused indexes identified by Supabase database linter
-- These indexes have never been used according to query statistics
-- and are safe to remove to reduce database overhead.

-- Hour blocks indexes
drop index if exists public.idx_hour_blocks_client;
drop index if exists public.idx_hour_blocks_created_by;

-- Time logs indexes
drop index if exists public.idx_time_logs_user;

-- Time log tasks indexes
drop index if exists public.idx_time_log_tasks_time_log;
drop index if exists public.idx_time_log_tasks_task;

-- Activity logs indexes
drop index if exists public.idx_activity_logs_actor;

-- Clients indexes
drop index if exists public.idx_clients_created_by;

-- Task attachments indexes
drop index if exists public.idx_task_attachments_uploaded_by;

-- Task comments indexes
drop index if exists public.idx_task_comments_author;

-- Tasks indexes
drop index if exists public.idx_tasks_created_by;
drop index if exists public.idx_tasks_updated_by;


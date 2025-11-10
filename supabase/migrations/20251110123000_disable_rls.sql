-- Phase 4: Disable legacy RLS policies now that application-level guards are in place.
-- This migration removes row level security enforcement from all app tables.
-- NOTE: Supabase Auth + Storage continue to rely on the Supabase platform SDKs.

alter table public.activity_logs disable row level security;
alter table public.activity_overview_cache disable row level security;
alter table public.client_members disable row level security;
alter table public.clients disable row level security;
alter table public.hour_blocks disable row level security;
alter table public.projects disable row level security;
alter table public.task_assignees disable row level security;
alter table public.task_attachments disable row level security;
alter table public.task_comments disable row level security;
alter table public.tasks disable row level security;
alter table public.time_log_tasks disable row level security;
alter table public.time_logs disable row level security;
alter table public.users disable row level security;



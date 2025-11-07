-- Simplify RLS policies so only admins can perform CRUD on key task tables.

-- =====================================================================
-- public.task_assignees
-- =====================================================================
drop policy if exists "Admins manage task assignees" on public.task_assignees;
drop policy if exists "Users view task assignees" on public.task_assignees;
drop policy if exists "Project collaborators insert task assignees" on public.task_assignees;
drop policy if exists "Project collaborators update task assignees" on public.task_assignees;
drop policy if exists "Project collaborators delete task assignees" on public.task_assignees;

create policy "Admins manage task assignees" on public.task_assignees
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- public.task_attachments
-- =====================================================================
drop policy if exists "Admins manage task attachments" on public.task_attachments;
drop policy if exists "Admins delete task attachments" on public.task_attachments;
drop policy if exists "Project collaborators read task attachments" on public.task_attachments;
drop policy if exists "Project collaborators create task attachments" on public.task_attachments;
drop policy if exists "Project managers update task attachments" on public.task_attachments;
drop policy if exists "Users view task attachments" on public.task_attachments;
drop policy if exists "Users create task attachments" on public.task_attachments;
drop policy if exists "Users update task attachments" on public.task_attachments;

create policy "Admins manage task attachments" on public.task_attachments
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- public.time_log_tasks
-- =====================================================================
drop policy if exists "Admins manage time log tasks" on public.time_log_tasks;
drop policy if exists "Users view time log tasks" on public.time_log_tasks;
drop policy if exists "Users create time log tasks" on public.time_log_tasks;
drop policy if exists "Users update time log tasks" on public.time_log_tasks;
drop policy if exists "Users delete time log tasks" on public.time_log_tasks;

create policy "Admins manage time log tasks" on public.time_log_tasks
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- public.time_logs
-- =====================================================================
drop policy if exists "Admins manage time logs" on public.time_logs;
drop policy if exists "Users view time logs" on public.time_logs;
drop policy if exists "Users create time logs" on public.time_logs;
drop policy if exists "Users update time logs" on public.time_logs;
drop policy if exists "Users delete time logs" on public.time_logs;

create policy "Admins manage time logs" on public.time_logs
  using (public.is_admin())
  with check (public.is_admin());

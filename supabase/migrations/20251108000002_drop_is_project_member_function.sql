-- Drop the obsolete is_project_member function
-- This function was replaced by user_is_project_member in migration 20251025153000_fix_project_member_rls.sql
-- and references the project_members table which was dropped in migration 20251108000000_remove_project_members.sql
drop function if exists public.is_project_member(uuid);


import "server-only";

import { cache } from "react";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DbClient,
  DbHourBlock,
  DbProject,
  DbTask,
  ProjectMemberWithUser,
  ProjectWithRelations,
} from "@/lib/types";

export const fetchProjectsWithRelations = cache(
  async (): Promise<ProjectWithRelations[]> => {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        name,
        code,
        status,
        description,
        client_id,
        starts_on,
        ends_on,
        created_at,
        updated_at,
        deleted_at,
        client:clients (
          id,
          name,
          slug,
          notes,
          created_at,
          updated_at,
          deleted_at
        ),
        members:project_members (
          id,
          project_id,
          user_id,
          role,
          created_at,
          deleted_at,
          user:users (
            id,
            email,
            full_name,
            role,
            avatar_url,
            created_at,
            updated_at,
            deleted_at
          )
        ),
        tasks:tasks (
          id,
          project_id,
          title,
          description,
          status,
          priority,
          due_on,
          created_by,
          updated_by,
          created_at,
          updated_at,
          deleted_at,
          assignees:task_assignees (
            user_id,
            deleted_at
          )
        ),
        hour_blocks:hour_blocks (
          id,
          project_id,
          title,
          block_type,
          hours_purchased,
          hours_consumed,
          notes,
          starts_on,
          ends_on,
          created_at,
          updated_at,
          deleted_at
        )
      `
      )
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load projects", error);
      throw error;
    }

    const normalize = (value: unknown) => value ?? null;

    return (
      (data as unknown as Array<
        DbProject & {
          client: DbClient | null;
          members: Array<ProjectMemberWithUser> | null;
          tasks: Array<
            DbTask & {
              assignees: Array<{ user_id: string; deleted_at: string | null }> | null;
            }
          > | null;
          hour_blocks: Array<DbHourBlock> | null;
        }
      > | null)
    )
      ?.map((project) => ({
        ...project,
        client: project.client ? { ...project.client, notes: normalize(project.client.notes) } : null,
        members: (project.members ?? [])
          .filter((member) => !member.deleted_at && member.user && !member.user.deleted_at)
          .map((member) => ({
            ...member,
            user: member.user!,
          })),
        tasks: (project.tasks ?? [])
          .filter((task) => !task.deleted_at)
          .map((task) => ({
            ...task,
            assignees: (task.assignees ?? []).filter((assignee) => !assignee.deleted_at),
          })),
        hour_blocks: (project.hour_blocks ?? []).filter(
          (block) => !block.deleted_at
        ),
      }))
      .filter(Boolean) as ProjectWithRelations[];
  }
);

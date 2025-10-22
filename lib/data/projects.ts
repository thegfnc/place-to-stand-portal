import "server-only";

import { cache } from "react";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  DbClient,
  DbHourBlock,
  DbProject,
  DbProjectMember,
  DbTask,
  DbUser,
  ProjectMemberWithUser,
  ProjectWithRelations,
  TaskWithRelations,
} from "@/lib/types";

export const fetchProjectsWithRelations = cache(
  async (): Promise<ProjectWithRelations[]> => {
  const supabase = getSupabaseServiceClient();

    const { data: projectRows, error: projectsError } = await supabase
      .from("projects")
      .select(
        `
        id,
        name,
        status,
        client_id,
        starts_on,
        ends_on,
        created_at,
        updated_at,
        deleted_at
      `
      )
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (projectsError) {
      console.error("Failed to load projects", projectsError);
      throw projectsError;
    }

    const projects = (projectRows ?? []) as DbProject[];
    const projectIds = projects.map((project) => project.id);
    const clientIds = Array.from(
      new Set(
        projects
          .map((project) => project.client_id)
          .filter((clientId): clientId is string => Boolean(clientId))
      )
    );

    const clientsPromise = clientIds.length
      ? supabase
          .from("clients")
          .select(
            `
            id,
            name,
            slug,
            notes,
            created_at,
            updated_at,
            deleted_at
          `
          )
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null });

    const membersPromise = projectIds.length
      ? supabase
          .from("project_members")
          .select(
            `
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
          `
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null });

    const tasksPromise = projectIds.length
      ? supabase
          .from("tasks")
          .select(
            `
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
          `
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null });

    const hourBlocksPromise = projectIds.length
      ? supabase
          .from("hour_blocks")
          .select(
            `
            id,
            project_id,
            hours_purchased,
            invoice_number,
            created_at,
            updated_at,
            deleted_at
          `
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null });

    const [{ data: clientsData, error: clientsError }, { data: membersData, error: membersError }, { data: tasksData, error: tasksError }, { data: hourBlocksData, error: hourBlocksError }] =
      await Promise.all([clientsPromise, membersPromise, tasksPromise, hourBlocksPromise]);

    if (clientsError) {
      console.error("Failed to load project clients", clientsError);
      throw clientsError;
    }

    if (membersError) {
      console.error("Failed to load project members", membersError);
      throw membersError;
    }

    if (tasksError) {
      console.error("Failed to load project tasks", tasksError);
      throw tasksError;
    }

    if (hourBlocksError) {
      console.error("Failed to load project hour blocks", hourBlocksError);
      throw hourBlocksError;
    }

    const clientLookup = new Map<string, DbClient>();
    (clientsData as DbClient[]).forEach((client) => {
      clientLookup.set(client.id, client);
    });

    const membersByProject = new Map<string, ProjectMemberWithUser[]>();
    (membersData as Array<DbProjectMember & { user: DbUser | null }>).forEach((member) => {
      if (!member || member.deleted_at || !member.user || member.user.deleted_at) {
        return;
      }
      const list = membersByProject.get(member.project_id) ?? [];
      list.push({ ...member, user: member.user });
      membersByProject.set(member.project_id, list);
    });

    const tasksByProject = new Map<string, TaskWithRelations[]>();
    (tasksData as Array<
      DbTask & {
        assignees: Array<{ user_id: string; deleted_at: string | null }> | null;
      }
    >).forEach((task) => {
      if (!task || task.deleted_at) {
        return;
      }
      const list = tasksByProject.get(task.project_id) ?? [];
      list.push({
        ...task,
        assignees: (task.assignees ?? [])
          .filter((assignee) => !assignee.deleted_at)
          .map((assignee) => ({ user_id: assignee.user_id })),
      });
      tasksByProject.set(task.project_id, list);
    });

    const hourBlocksByProject = new Map<string, DbHourBlock[]>();
    (hourBlocksData as DbHourBlock[]).forEach((block) => {
      if (!block || block.deleted_at) {
        return;
      }
      const list = hourBlocksByProject.get(block.project_id) ?? [];
      list.push(block);
      hourBlocksByProject.set(block.project_id, list);
    });

    return projects.map((project) => ({
      ...project,
      client: project.client_id ? clientLookup.get(project.client_id) ?? null : null,
      members: membersByProject.get(project.id) ?? [],
      tasks: tasksByProject.get(project.id) ?? [],
      hour_blocks: hourBlocksByProject.get(project.id) ?? [],
    }));
  }
);

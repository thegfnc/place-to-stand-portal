import type { Metadata } from "next";

import { ProjectsSettingsTable } from "./projects-table";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/supabase/types/database";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

export const metadata: Metadata = {
  title: "Projects | Settings",
};

export default async function ProjectsSettingsPage() {
  await requireRole("ADMIN");

  const supabase = getSupabaseServiceClient();

  const [{ data: projects, error: projectsError }, { data: clients, error: clientsError }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        id,
        name,
        status,
        client_id,
  created_by,
        starts_on,
        ends_on,
        created_at,
        updated_at,
        deleted_at
      `
      )
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase.from("clients").select("id, name, deleted_at").order("name"),
  ]);

  if (projectsError) {
    console.error("Failed to load projects for settings", projectsError);
  }

  if (clientsError) {
    console.error("Failed to load clients for project settings", clientsError);
  }

  const clientLookup = new Map((clients ?? []).map((client) => [client.id, client] as const));

  const hydratedProjects: ProjectWithClient[] = (projects ?? []).map((project) => ({
    ...project,
    client: project.client_id ? clientLookup.get(project.client_id) ?? null : null,
  }));

  return <ProjectsSettingsTable projects={hydratedProjects} clients={(clients ?? []) as ClientRow[]} />;
}

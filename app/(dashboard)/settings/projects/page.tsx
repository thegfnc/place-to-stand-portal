import type { Metadata } from "next";

import { ProjectsSettingsTable } from "./projects-table";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/supabase/types/database";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

export const metadata: Metadata = {
  title: "Projects | Settings",
};

export default async function ProjectsSettingsPage() {
  await requireRole("ADMIN");

  const supabase = getSupabaseServerClient();

  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
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
          deleted_at
        )
      `
      )
      .order("name", { ascending: true }),
    supabase.from("clients").select("id, name, deleted_at").order("name"),
  ]);

  return (
    <ProjectsSettingsTable
      projects={(projects ?? []) as ProjectWithClient[]}
      clients={(clients ?? []) as ClientRow[]}
    />
  );
}

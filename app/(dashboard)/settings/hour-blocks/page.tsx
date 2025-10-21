import type { Metadata } from "next";

import { HourBlocksSettingsTable } from "./hour-blocks-table";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/supabase/types/database";

type HourBlockRow = Database["public"]["Tables"]["hour_blocks"]["Row"];
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name" | "deleted_at">;

type HourBlockWithProject = HourBlockRow & { project: ProjectRow | null };

export const metadata: Metadata = {
  title: "Hour Blocks | Settings",
};

export default async function HourBlocksSettingsPage() {
  await requireRole("ADMIN");

  const supabase = getSupabaseServiceClient();

  const [{ data: hourBlocks, error: hourBlocksError }, { data: projects, error: projectsError }] = await Promise.all([
    supabase
      .from("hour_blocks")
      .select(
        `
        id,
        project_id,
        title,
        block_type,
        hours_purchased,
        hours_consumed,
        notes,
        starts_on,
        ends_on,
        created_by,
        created_at,
        updated_at,
        deleted_at,
        project:projects (
          id,
          name,
          deleted_at
        )
      `
      )
      .order("updated_at", { ascending: false }),
    supabase.from("projects").select("id, name, deleted_at").order("name"),
  ]);

  if (hourBlocksError) {
    console.error("Failed to load hour blocks for settings", hourBlocksError);
  }

  if (projectsError) {
    console.error("Failed to load projects for hour block settings", projectsError);
  }

  return (
    <HourBlocksSettingsTable
      hourBlocks={(hourBlocks ?? []) as HourBlockWithProject[]}
      projects={(projects ?? []) as ProjectRow[]}
    />
  );
}

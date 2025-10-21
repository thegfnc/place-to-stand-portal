import type { Metadata } from "next";

import { ClientsSettingsTable } from "./clients-table";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Clients | Settings",
};

export default async function ClientsSettingsPage() {
  await requireRole("ADMIN");
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, name, slug, notes, created_by, created_at, updated_at, deleted_at, projects:projects ( id, deleted_at )`
    )
    .is("deleted_at", null)
    .order("name");

  if (error) {
    console.error("Failed to load clients for settings", error);
  }

  return <ClientsSettingsTable clients={data ?? []} />;
}

import type { Metadata } from "next";

import { ClientsSettingsTable } from "./clients-table";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clients | Settings",
};

export default async function ClientsSettingsPage() {
  await requireRole("ADMIN");
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select(
      `id, name, slug, notes, created_by, created_at, updated_at, deleted_at, projects:projects ( id, deleted_at )`
    )
    .order("name");

  return <ClientsSettingsTable clients={data ?? []} />;
}

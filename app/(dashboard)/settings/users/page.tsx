import type { Metadata } from "next";

import { UsersSettingsTable } from "./users-table";
import { requireRole, requireUser } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Users | Settings",
};

export default async function UsersSettingsPage() {
  const currentUser = await requireUser();
  await requireRole("ADMIN");
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, avatar_url, created_at, updated_at, deleted_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load users for settings", error);
  }

  return <UsersSettingsTable users={data ?? []} currentUserId={currentUser.id} />;
}

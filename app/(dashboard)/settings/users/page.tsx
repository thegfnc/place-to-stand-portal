import type { Metadata } from "next";

import { UsersSettingsTable } from "./users-table";
import { requireRole, requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Users | Settings",
};

export default async function UsersSettingsPage() {
  const currentUser = await requireUser();
  await requireRole("ADMIN");
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("users")
  .select("id, email, full_name, role, avatar_url, created_at, updated_at, deleted_at")
    .order("created_at", { ascending: false });

  return <UsersSettingsTable users={data ?? []} currentUserId={currentUser.id} />;
}

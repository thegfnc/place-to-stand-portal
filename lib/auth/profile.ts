import "server-only";

import type { User } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/auth/session";
import type { Database } from "@/supabase/types/database";

const DEFAULT_ROLE: UserRole = "CLIENT";

function resolveRole(user: User): UserRole {
  const role = (user.user_metadata?.role as UserRole | undefined)?.toUpperCase();

  if (role === "ADMIN" || role === "CONTRACTOR" || role === "CLIENT") {
    return role;
  }

  return DEFAULT_ROLE;
}

export async function ensureUserProfile(user: User) {
  const supabase = getSupabaseServiceClient();

  const { data: existing, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to lookup user profile", error);
    throw error;
  }

  const payload: Database["public"]["Tables"]["users"]["Insert"] = {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    role: resolveRole(user),
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    deleted_at: null,
  };

  if (!existing) {
    const { error: insertError } = await supabase.from("users").insert(payload);

    if (insertError) {
      console.error("Failed to create user profile", insertError);
      throw insertError;
    }

    return;
  }

  const shouldUpdate =
    existing.email !== payload.email || existing.role !== payload.role;

  if (!shouldUpdate) {
    return;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      email: payload.email,
      full_name: payload.full_name,
      avatar_url: payload.avatar_url,
      role: payload.role,
      deleted_at: null,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Failed to update user profile", updateError);
    throw updateError;
  }
}

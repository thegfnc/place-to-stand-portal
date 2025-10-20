import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import type { Database } from "@/supabase/types/database";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = Database["public"]["Tables"]["users"]["Row"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to resolve Supabase session", error);
    return null;
  }

  return data.session ?? null;
});

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to resolve Supabase user", error);
    return null;
  }

  if (!user?.id) {
    return null;
  }

  const { data, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load current user", profileError);
    return null;
  }

  return data ?? null;
});

export const requireUser = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
};

export const requireRole = async (allowed: UserRole | UserRole[]) => {
  const user = await requireUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  if (!roles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
};

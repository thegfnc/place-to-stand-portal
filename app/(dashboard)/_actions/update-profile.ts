'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type UpdateProfileInput = {
  fullName: string;
  password?: string | null;
};

type UpdateProfileResult = {
  error?: string;
};

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or fewer"),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const user = await requireUser();

  const cleanedInput = {
    fullName: input.fullName?.trim() ?? "",
    password: input.password?.trim() ? input.password.trim() : undefined,
  };

  const parsed = updateProfileSchema.safeParse(cleanedInput);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile update payload." };
  }

  const { fullName, password } = parsed.data;
  const supabase = getSupabaseServerClient();
  const supabaseAdmin = getSupabaseServiceClient();

  const { error: profileError } = await supabaseAdmin
    .from("users")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (profileError) {
    console.error("Failed to update profile row", profileError);
    return { error: profileError.message };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
    ...(password ? { password } : {}),
  });

  if (authError) {
    console.error("Failed to update auth profile", authError);
    return { error: authError.message };
  }

  revalidatePath("/settings/users");

  return {};
}

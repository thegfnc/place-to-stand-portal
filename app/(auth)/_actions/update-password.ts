"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export type CompletePasswordResetInput = z.infer<typeof schema>;

export type CompletePasswordResetResult = {
  error?: string;
};

export async function completePasswordReset(
  input: CompletePasswordResetInput
): Promise<CompletePasswordResetResult> {
  await requireUser();
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid password reset payload.",
    };
  }

  const { password } = parsed.data;
  const supabase = getSupabaseServerClient();

  const {
    data: { user: authUser },
    error: authLookupError,
  } = await supabase.auth.getUser();

  if (authLookupError || !authUser) {
    console.error("Failed to load auth user for password reset", authLookupError);
    return {
      error: authLookupError?.message ?? "Unable to verify your session. Please sign in again.",
    };
  }

  const metadata = {
    ...(authUser.user_metadata ?? {}),
    must_reset_password: false,
  } as Record<string, unknown>;

  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: metadata,
  });

  if (authError) {
    console.error("Failed to update password", authError);
    return { error: authError.message };
  }

  return {};
}

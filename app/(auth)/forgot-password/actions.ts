"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  redirect: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }

      if (!value.startsWith("/")) {
        return null;
      }

      if (value.startsWith("//")) {
        return null;
      }

      return value;
    }),
});

export type ForgotPasswordState = {
  error?: string;
  success?: boolean;
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const result = schema.safeParse({
    email: formData.get("email"),
    redirect: formData.get("redirect"),
  });

  if (!result.success) {
    return { error: "Enter a valid email." };
  }

  const supabase = getSupabaseServerClient();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    serverEnv.APP_BASE_URL ??
    "http://localhost:3000";

  const resetPath = result.data.redirect
    ? `/reset-password?redirect=${encodeURIComponent(result.data.redirect)}`
    : "/reset-password";

  const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
    redirectTo: `${origin}${resetPath}`,
  });

  if (error) {
    console.error("Failed to send password reset email", error);
    return { error: "We couldn't send reset instructions. Please try again." };
  }

  return { success: true };
}

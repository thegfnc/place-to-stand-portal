'use server';

import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureUserProfile } from "@/lib/auth/profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z
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

export type SignInState = {
  error?: string;
};

export async function signInWithPassword(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const result = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!result.success) {
    return {
      error: "Please provide a valid email and password.",
    };
  }

  const { email, password, redirectTo } = result.data;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error: error?.message ?? "Unable to sign in. Please try again.",
    };
  }

  await ensureUserProfile(data.user);

  const mustReset = Boolean(
    (data.user.user_metadata?.must_reset_password as boolean | undefined)
  );

  if (mustReset) {
    redirect("/force-reset-password");
  }

  redirect(redirectTo ?? "/");
}

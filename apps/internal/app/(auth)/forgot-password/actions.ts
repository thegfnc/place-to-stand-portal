"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { allowAuthEmail } from "@/lib/auth/throttle";
import { sendPasswordResetEmail } from "@/lib/email/auth-emails";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
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

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    serverEnv.APP_BASE_URL ??
    "http://localhost:3000";

  const resetPath = result.data.redirect
    ? `/reset-password?redirect=${encodeURIComponent(result.data.redirect)}`
    : "/reset-password";

  // Same response as an unknown address: "throttled" must not be
  // distinguishable from "no account".
  if (!(await allowAuthEmail(result.data.email.toLowerCase()))) {
    return { success: true };
  }

  try {
    const { data, error } =
      await getSupabaseServiceClient().auth.admin.generateLink({
        type: "recovery",
        email: result.data.email,
      });

    const tokenHash = data?.properties?.hashed_token;

    if (error || !tokenHash) {
      // Expected for any address without an account. `resetPasswordForEmail`
      // used to absorb that case silently; `generateLink` reports it, so the
      // swallowing has to happen here instead — surfacing it would turn this
      // form into an account-enumeration oracle.
      console.error("Failed to generate password reset link", error);
      return { success: true };
    }

    // Our own /auth/confirm, not `properties.action_link`. Supabase's link
    // returns the session in the URL fragment, which never reaches the server,
    // and its redirect target has to be on the allowlist — which is exactly why
    // reset used to fall back to the sign-in screen.
    const params = new URLSearchParams({
      token_hash: tokenHash,
      type: "recovery",
      redirect_to: resetPath,
    });

    await sendPasswordResetEmail(
      result.data.email,
      `${origin}/auth/confirm?${params}`
    );
  } catch (cause) {
    console.error("Unable to send password reset email", cause);
  }

  return { success: true };
}

'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { allowAuthEmail } from "@/lib/auth/throttle";

import { ensureUserProfile } from "@/lib/auth/profile";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendMagicLinkEmail } from "@/lib/email/auth-emails";
import { serverEnv } from "@/lib/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

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
  /** Set when a client-portal (CLIENT role) account tried to sign in here. */
  clientPortalUrl?: string;
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

  // Supabase bans disabled users, but the DB flag is the source of truth —
  // reject here too so a manually flagged account never gets a session.
  const [profile] = await db
    .select({ disabledAt: users.disabledAt, role: users.role })
    .from(users)
    .where(eq(users.id, data.user.id))
    .limit(1);

  if (profile?.disabledAt) {
    await supabase.auth.signOut();
    return {
      error: "This account has been disabled. Contact an administrator.",
    };
  }

  // The internal portal is admin-only. Portal (CLIENT) users sign in on the
  // client portal instead — drop the session and point them there. The `profile &&`
  // guard matters: a missing row is "no account", handled separately below.
  if (profile && profile.role !== "ADMIN") {
    await supabase.auth.signOut();
    return { clientPortalUrl: serverEnv.CLIENT_PORTAL_URL };
  }

  // A provisioned user can't reach this branch — password sign-in implies an
  // admin-created account. Handled rather than ignored so the strict-provisioning
  // contract holds at every call site.
  const profileResult = await ensureUserProfile(data.user);

  if (profileResult === "not_provisioned") {
    await supabase.auth.signOut();
    redirect("/account-not-set-up");
  }

  const mustReset = Boolean(
    (data.user.user_metadata?.must_reset_password as boolean | undefined)
  );

  if (mustReset) {
    redirect("/force-reset-password");
  }

  redirect(redirectTo ?? "/");
}

/* ------------------------------------------------------------------ */
/*  Magic link                                                        */
/* ------------------------------------------------------------------ */

export type MagicLinkState = {
  error?: string;
  success?: boolean;
};

export async function sendMagicLink(input: {
  email: string;
  redirectTo?: string | null;
}): Promise<MagicLinkState> {
  const email = input.email?.trim();
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address." };
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    serverEnv.APP_BASE_URL ??
    "http://localhost:3000";

  // Same response as an unknown address: "throttled" must not be
  // distinguishable from "no account".
  if (!(await allowAuthEmail(email.toLowerCase()))) {
    return { success: true };
  }

  try {
    // `generateLink` never creates an account, which is what `shouldCreateUser:
    // false` bought on the old `signInWithOtp` path — an unknown address simply
    // errors here rather than minting an auth user.
    const { data, error } =
      await getSupabaseServiceClient().auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    const tokenHash = data?.properties?.hashed_token;

    if (error || !tokenHash) {
      // Logged, never surfaced: unknown addresses land here, and reporting that
      // difference would turn this form into an account-enumeration oracle. The
      // caller shows the same copy either way.
      console.error("Failed to generate magic link", error);
      return { success: true };
    }

    // Our own /auth/confirm rather than `properties.action_link`, which returns
    // the session in a URL fragment the server never sees.
    const params = new URLSearchParams({
      token_hash: tokenHash,
      type: "magiclink",
      ...(input.redirectTo ? { redirect_to: input.redirectTo } : {}),
    });

    await sendMagicLinkEmail(email, `${origin}/auth/confirm?${params}`);
  } catch (cause) {
    console.error("Unable to send magic link email", cause);
  }

  return { success: true };
}

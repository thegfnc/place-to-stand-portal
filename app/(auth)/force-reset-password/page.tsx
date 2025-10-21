import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PasswordResetForm } from "./force-reset-form";

type PageProps = {
  searchParams?: Promise<{ redirect?: string }>;
};

export const metadata: Metadata = {
  title: "Update password | Place to Stand Portal",
};

export default async function ForceResetPasswordPage({ searchParams }: PageProps) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  const mustReset = Boolean(user.user_metadata?.must_reset_password);

  if (!mustReset) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-background p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create a new password</h1>
          <p className="text-sm text-muted-foreground">
            For security, you need to update your password before accessing the portal.
          </p>
        </div>
  <PasswordResetForm redirectTo={redirectTo} email={user.email} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PasswordResetForm } from "../force-reset-password/force-reset-form";

type PageProps = {
  searchParams?: Promise<{
    code?: string;
    error?: string;
    error_description?: string;
    redirect?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Set new password | Place To Stand Portal",
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const supabase = getSupabaseServerClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;
  let errorMessage: string | null = null;

  if (resolvedSearchParams?.error_description) {
    errorMessage = resolvedSearchParams.error_description;
  }

  if (resolvedSearchParams?.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      resolvedSearchParams.code
    );

    if (exchangeError) {
      console.error("Failed to exchange password recovery code", exchangeError);
      errorMessage = "This password reset link is invalid or has expired.";
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to resolve user during password recovery", error);
    errorMessage = "We couldn't verify your session. Please request a new reset link.";
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
        <div className="w-full max-w-sm space-y-6 rounded-xl bg-background p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Reset link not valid</h1>
          <p className="text-sm text-muted-foreground">
            {errorMessage ?? "We couldn't verify that link. It may have expired or already been used."}
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-background p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a strong password to keep your account secure.
          </p>
        </div>
        {errorMessage ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <PasswordResetForm redirectTo={redirectTo} email={user.email} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

type PageProps = {
  searchParams?: Promise<{ redirect?: string }>;
};

export const metadata: Metadata = {
  title: "Reset password | Place To Stand Portal",
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-sm space-y-8 rounded-xl bg-background p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to create a new password.
          </p>
        </div>
  <ForgotPasswordForm redirectTo={redirectTo} />
        <div className="text-center text-sm">
          <Link
            href={redirectTo ? `/sign-in?redirect=${encodeURIComponent(redirectTo)}` : "/sign-in"}
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

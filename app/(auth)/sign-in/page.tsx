import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { SignInForm } from "./sign-in-form";

type PageProps = {
  searchParams?: Promise<{ redirect?: string }>;
};

export const metadata: Metadata = {
  title: "Sign in | Place to Stand Portal",
};

export default async function SignInPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-sm space-y-8 rounded-xl bg-background p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your work email to manage your projects.
          </p>
        </div>
        <SignInForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInWithPassword, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = {};

type Props = {
  redirectTo?: string;
};

export function SignInForm({ redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(
    signInWithPassword,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
          </span>
        ) : (
          "Sign in"
        )}
      </Button>
      <div className="text-center text-sm">
        <Link
          href={redirectTo ? `/forgot-password?redirect=${encodeURIComponent(redirectTo)}` : "/forgot-password"}
          className="font-medium text-primary hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

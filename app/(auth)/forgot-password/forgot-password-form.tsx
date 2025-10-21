"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "./actions";

const INITIAL_STATE: ForgotPasswordState = {};
const pendingReason = "Please wait for the current request to finish.";

type Props = {
  redirectTo?: string;
};

export function ForgotPasswordForm({ redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="redirect" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
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
        </DisabledFieldTooltip>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          If that email is associated with an account, we just sent instructions to reset the password.
        </p>
      ) : null}
      <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending...
            </span>
          ) : (
            "Send reset link"
          )}
        </Button>
      </DisabledFieldTooltip>
    </form>
  );
}

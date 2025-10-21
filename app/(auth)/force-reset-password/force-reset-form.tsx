"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { completePasswordReset } from "@/app/(auth)/_actions/update-password";
import { Button } from "@/components/ui/button";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters."),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match.",
  });

type FormValues = z.infer<typeof formSchema>;

type Props = {
  redirectTo?: string;
  email?: string | null;
};

const pendingReason = "Please wait for the current request to finish.";

export function PasswordResetForm({ redirectTo, email }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);

      const result = await completePasswordReset(values);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      toast({
        title: "Password updated",
        description: "Thanks for securing your account.",
      });

      form.reset({ password: "", confirmPassword: "" });
      router.replace(redirectTo && !redirectTo.startsWith("/force-reset-password") ? redirectTo : "/");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {email ? (
        <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      ) : null}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {feedback ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {feedback}
            </p>
          ) : null}
          <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Saving..." : "Save password"}
            </Button>
          </DisabledFieldTooltip>
        </form>
      </Form>
    </div>
  );
}

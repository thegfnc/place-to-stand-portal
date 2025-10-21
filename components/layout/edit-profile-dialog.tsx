'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { updateProfile } from "@/app/(dashboard)/_actions/update-profile";
import { Button } from "@/components/ui/button";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import type { AppUser } from "@/lib/auth/session";

const formSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or fewer"),
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.trim().length >= 8, {
      message: "Password must be at least 8 characters.",
    }),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser;
};

const pendingReason = "Please wait for the current request to finish.";

export function EditProfileDialog({ open, onOpenChange, user }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user.full_name ?? "",
      password: "",
    },
  });

  const resetForm = useCallback(() => {
    form.reset({
      fullName: user.full_name ?? "",
      password: "",
    });
    setFeedback(null);
  }, [form, user.full_name]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const closeAndReset = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleOpenChange = (next: boolean) => {
    if (!next && isPending) {
      return;
    }

    if (!next) {
      resetForm();
    }

    onOpenChange(next);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);

      const payload = {
        fullName: values.fullName.trim(),
        password: values.password?.trim() ? values.password.trim() : undefined,
      };

      const result = await updateProfile(payload);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      toast({
        title: "Profile updated",
        description: "Your changes were saved successfully.",
      });

      closeAndReset();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your display name or reset your password.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => {
                const disabled = isPending;
                const reason = disabled ? pendingReason : null;

                return (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Ada Lovelace"
                          autoComplete="name"
                          disabled={disabled}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => {
                const disabled = isPending;
                const reason = disabled ? pendingReason : null;

                return (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          type="password"
                          autoComplete="new-password"
                          disabled={disabled}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormDescription>Leave blank to keep your current password.</FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {feedback ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {feedback}
              </p>
            ) : null}
            <DialogFooter className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

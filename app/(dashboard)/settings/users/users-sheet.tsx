'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/supabase/types/database";

import { AvatarUploadField } from "@/components/forms/avatar-upload-field";
import { createUser, softDeleteUser, updateUser } from "./actions";

function deriveInitials(fullName?: string | null, email?: string | null) {
  const safeName = fullName?.trim();

  if (safeName) {
    const segments = safeName.split(/\s+/).filter(Boolean).slice(0, 2);

    if (segments.length > 0) {
      return segments.map((segment) => segment.charAt(0).toUpperCase()).join("") || "??";
    }
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "??";
}

const USER_ROLES = ["ADMIN", "CONTRACTOR", "CLIENT"] as const;
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const baseSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Provide a valid email"),
  role: z.enum(USER_ROLES),
  avatarPath: z.string().trim().min(1).max(255).optional().nullable(),
  avatarRemoved: z.boolean().optional(),
});

const editSchema = baseSchema.extend({
  password: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const trimmed = value?.trim() ?? "";

      if (trimmed.length > 0 && trimmed.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters.",
        });
      }
    }),
});

type FormValues = z.infer<typeof editSchema>;

const createResolver = zodResolver(
  baseSchema.extend({ password: z.string().optional() })
) as Resolver<FormValues>;
const editResolver: Resolver<FormValues> = zodResolver(editSchema);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  user: UserRow | null;
  currentUserId: string;
};

export function UserSheet({
  open,
  onOpenChange,
  onComplete,
  user,
  currentUserId,
}: Props) {
  const isEditing = Boolean(user);
  const editingSelf = isEditing && user?.id === currentUserId;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [avatarFieldKey, setAvatarFieldKey] = useState(0);
  const { toast } = useToast();
  const pendingReason = "Please wait for the current request to finish.";
  const emailChangeRestriction = "Email cannot be changed after the account is created.";
  const roleChangeRestriction = "You cannot change your own role.";

  const resolver = useCallback<Resolver<FormValues>>(
    (values, context, options) =>
      (isEditing ? editResolver : createResolver)(values, context, options),
    [isEditing]
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CONTRACTOR",
      password: "",
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CONTRACTOR",
      password: "",
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
    });
    form.clearErrors();
    setFeedback(null);
    setAvatarFieldKey((key) => key + 1);
  }, [form, open, user]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);

      const trimmedPassword = values.password?.trim() ?? "";
      const normalizedAvatarPath = values.avatarPath?.trim() ? values.avatarPath.trim() : undefined;
      const avatarRemoved = Boolean(values.avatarRemoved);

      if (isEditing && user) {
        const result = await updateUser({
          id: user.id,
          fullName: values.fullName,
          role: editingSelf ? user.role : values.role,
          password: trimmedPassword.length >= 8 ? trimmedPassword : undefined,
          avatarPath: normalizedAvatarPath,
          avatarRemoved,
        });

        if (result.error) {
          setFeedback(result.error);
          return;
        }

        toast({
          title: "User updated",
          description: "Changes saved successfully.",
        });
      } else {
        const result = await createUser({
          email: values.email,
          fullName: values.fullName,
          role: values.role,
          avatarPath: normalizedAvatarPath,
        });

        if (result.error) {
          setFeedback(result.error);
          return;
        }

        toast({
          title: "Invite sent",
          description: "The new teammate received their login details via email.",
        });
      }

      onOpenChange(false);
      onComplete();
    });
  };

  const handleDelete = () => {
    if (!user || user.id === currentUserId) {
      setFeedback("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      "Deleting this user will remove their access. Proceed?"
    );

    if (!confirmed) return;

    startTransition(async () => {
      setFeedback(null);
      const result = await softDeleteUser({ id: user.id });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      onOpenChange(false);
      onComplete();
      toast({
        title: "User deleted",
        description: `${user.full_name ?? user.email} can no longer access the portal.`,
      });
    });
  };

  const deleteDisabled = isPending || user?.id === currentUserId;
  const deleteDisabledReason = deleteDisabled
    ? isPending
      ? pendingReason
      : user?.id === currentUserId
        ? "You cannot delete your own account."
        : null
    : null;

  const submitDisabled = isPending;
  const submitDisabledReason = submitDisabled ? pendingReason : null;
  const watchedFullName = form.watch("fullName");
  const watchedEmail = form.watch("email");
  const avatarInitials = deriveInitials(watchedFullName || user?.full_name, watchedEmail || user?.email);
  const avatarDisplayName = watchedFullName || user?.full_name || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{isEditing ? "Edit user" : "Add user"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the member's access level or reset their credentials."
              : "Provision a new teammate with immediate access to the portal."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-5 px-6 pb-6"
          >
            <FormField
              control={form.control}
              name="avatarPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar</FormLabel>
                  <FormControl>
                    <AvatarUploadField
                      key={avatarFieldKey}
                      value={field.value ?? null}
                      onChange={(next) => {
                        form.setValue("avatarPath", next, { shouldDirty: true });
                      }}
                      onRemovalChange={(removed) => {
                        form.setValue("avatarRemoved", removed, { shouldDirty: true });
                      }}
                      initials={avatarInitials}
                      displayName={avatarDisplayName}
                      disabled={isPending}
                      targetUserId={user?.id}
                      existingUserId={user?.id ?? null}
                    />
                  </FormControl>
                  <FormDescription>This image appears anywhere their initials would otherwise display.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                          disabled={disabled}
                          aria-required
                          aria-invalid={Boolean(form.formState.errors.fullName)}
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
              name="email"
              render={({ field }) => {
                const disabled = isPending || isEditing;
                const reason = disabled
                  ? isPending
                    ? pendingReason
                    : emailChangeRestriction
                  : null;

                return (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          type="email"
                          placeholder="ada@example.com"
                          autoComplete="email"
                          disabled={disabled}
                          aria-required
                          aria-invalid={Boolean(form.formState.errors.email)}
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
              name="role"
              render={({ field }) => {
                const disabled = isPending || editingSelf;
                const reason = disabled
                  ? isPending
                    ? pendingReason
                    : editingSelf
                      ? roleChangeRestriction
                      : null
                  : null;

                return (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={disabled}
                      aria-required="true"
                    >
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </DisabledFieldTooltip>
                      </FormControl>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0) + role.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {isEditing ? (
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
                            aria-invalid={Boolean(form.formState.errors.password)}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormDescription>Leave blank to keep the existing password. Setting a new one will require the user to update it on their next login.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                A secure temporary password will be generated and emailed to the teammate. They must set a new password when they first sign in.
              </div>
            )}
            {feedback ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {feedback}
              </p>
            ) : null}
            <SheetFooter className="flex items-center justify-end gap-3 px-0 pb-0 pt-6">
              {isEditing ? (
                <DisabledFieldTooltip disabled={deleteDisabled} reason={deleteDisabledReason}>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteDisabled}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </DisabledFieldTooltip>
              ) : null}
              <DisabledFieldTooltip disabled={submitDisabled} reason={submitDisabledReason}>
                <Button type="submit" disabled={submitDisabled}>
                  {isPending ? "Saving..." : isEditing ? "Save changes" : "Create user"}
                </Button>
              </DisabledFieldTooltip>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

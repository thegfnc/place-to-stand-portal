'use client';

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import type { Database } from "@/supabase/types/database";

import { createUser, softDeleteUser, updateUser } from "./actions";

const USER_ROLES = ["ADMIN", "CONTRACTOR", "CLIENT"] as const;
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Provide a valid email"),
  role: z.enum(USER_ROLES),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CONTRACTOR",
      password: "",
    },
  });

  useEffect(() => {
    form.reset({
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CONTRACTOR",
      password: "",
    });
    setFeedback(null);
  }, [form, user]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);

      if (isEditing && user) {
        if (values.password && values.password.trim().length > 0 && values.password.trim().length < 8) {
          setFeedback("New password must be at least 8 characters.");
          return;
        }

        const result = await updateUser({
          id: user.id,
          fullName: values.fullName.trim(),
          role: values.role,
          password: values.password?.trim()
            ? values.password.trim()
            : undefined,
        });

        if (result.error) {
          setFeedback(result.error);
          return;
        }
      } else {
        if (!values.password || values.password.trim().length < 8) {
          setFeedback("Password must be at least 8 characters.");
          return;
        }

        const result = await createUser({
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          role: values.role,
          password: values.password.trim(),
        });

        if (result.error) {
          setFeedback(result.error);
          return;
        }
      }

      onOpenChange(false);
      onComplete();
    });
  };

  const handleSoftDelete = () => {
    if (!user || user.id === currentUserId) {
      setFeedback("You cannot deactivate your own account.");
      return;
    }

    const confirmed = window.confirm(
      "Deactivating this user will remove their access. Proceed?"
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
    });
  };

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
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ada Lovelace"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="ada@example.com"
                      disabled={isPending || isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isPending}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
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
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditing ? "New password" : "Temporary password"}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="password"
                      placeholder="••••••••"
                      disabled={isPending}
                    />
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
            <SheetFooter className="flex items-center justify-between gap-2 px-0 pb-0 pt-6">
              {isEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSoftDelete}
                  disabled={isPending || user?.id === currentUserId}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Create user"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

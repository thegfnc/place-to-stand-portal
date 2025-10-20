'use client';

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Database } from "@/supabase/types/database";

import { saveClient, softDeleteClient } from "./actions";

const formSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only")
    .or(z.literal(""))
    .optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  client: ClientRow | null;
};

export function ClientSheet({ open, onOpenChange, onComplete, client }: Props) {
  const isEditing = Boolean(client);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name ?? "",
      slug: client?.slug ?? "",
      notes: client?.notes ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: client?.name ?? "",
      slug: client?.slug ?? "",
      notes: client?.notes ?? "",
    });
    setFeedback(null);
  }, [client, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);

      const payload = {
        id: client?.id,
        name: values.name.trim(),
        slug: values.slug?.trim() ? values.slug.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      };

      if (payload.slug && payload.slug.length < 3) {
        setFeedback("Slug must be at least 3 characters when provided.");
        return;
      }

      const result = await saveClient(payload);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      onOpenChange(false);
      onComplete();
    });
  };

  const handleArchive = () => {
    if (!client) return;

    const confirmed = window.confirm(
      "Archiving this client hides it from selectors and reporting. Existing projects stay linked."
    );

    if (!confirmed) return;

    startTransition(async () => {
      setFeedback(null);
      const result = await softDeleteClient({ id: client.id });

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
          <SheetTitle>{isEditing ? "Edit client" : "Add client"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Adjust display details or archive the organization."
              : "Register a client so projects and reporting stay organized."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-5 px-6 pb-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Acme Corp"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="acme"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Context or points of contact"
                      disabled={isPending}
                      rows={4}
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
                  onClick={handleArchive}
                  disabled={isPending}
                >
                  Archive
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Create client"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useToast } from "@/components/ui/use-toast";
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
  const { toast } = useToast();
  const pendingReason = "Please wait for the current request to finish.";

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
    startTransition(() => {
      setFeedback(null);
    });
  }, [client, form, startTransition]);

  const onSubmit = (values: FormValues) => {
    if (isEditing && !values.slug?.trim()) {
      form.setError("slug", { type: "manual", message: "Slug is required" });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const payload = {
        id: client?.id,
        name: values.name.trim(),
        slug: isEditing ? (values.slug?.trim() ? values.slug.trim() : null) : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      } satisfies Parameters<typeof saveClient>[0];

      if (payload.slug && payload.slug.length < 3) {
        setFeedback("Slug must be at least 3 characters when provided.");
        return;
      }

      const result = await saveClient(payload);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      toast({
        title: isEditing ? "Client updated" : "Client created",
        description: isEditing
          ? "Changes saved successfully."
          : "The client is ready for new projects.",
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const handleDelete = () => {
    if (!client) return;

    const confirmed = window.confirm(
      "Deleting this client hides it from selectors and reporting. Existing projects stay linked."
    );

    if (!confirmed) return;

    startTransition(async () => {
      setFeedback(null);
      const result = await softDeleteClient({ id: client.id });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      toast({
        title: "Client deleted",
        description: `${client.name} is hidden from selectors but remains available for history.`,
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const deleteDisabled = isPending;
  const deleteDisabledReason = deleteDisabled ? pendingReason : null;
  const submitDisabled = isPending;
  const submitDisabledReason = submitDisabled ? pendingReason : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{isEditing ? "Edit client" : "Add client"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Adjust display details or delete the organization."
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
              render={({ field }) => {
                const disabled = isPending;
                const reason = disabled ? pendingReason : null;

                return (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Acme Corp"
                          disabled={disabled}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {isEditing ? (
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            placeholder="acme"
                            disabled={disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : null}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => {
                const disabled = isPending;
                const reason = disabled ? pendingReason : null;

                return (
                  <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Context or points of contact"
                          disabled={disabled}
                          rows={4}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
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
                  {isPending ? "Saving..." : isEditing ? "Save changes" : "Create client"}
                </Button>
              </DisabledFieldTooltip>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

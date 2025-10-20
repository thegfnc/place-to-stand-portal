'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  PROJECT_STATUS_ENUM_VALUES,
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_VALUES,
  type ProjectStatusValue,
} from "@/lib/constants";
import type { Database } from "@/supabase/types/database";

import { saveProject, softDeleteProject } from "./actions";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name" | "deleted_at">;

type ProjectWithClient = ProjectRow & { client: ClientRow | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  project: ProjectWithClient | null;
  clients: ClientRow[];
};

const formSchema = z
  .object({
    name: z.string().min(1, "Project name is required"),
    clientId: z.string().uuid("Select a client"),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    code: z
      .string()
      .max(32, "Code must be 32 characters or fewer")
      .optional()
      .or(z.literal("")),
    description: z
      .string()
      .max(1000, "Description must be 1000 characters or fewer")
      .optional()
      .or(z.literal("")),
    startsOn: z.string().optional().or(z.literal("")),
    endsOn: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.startsOn && data.endsOn) {
      const start = new Date(data.startsOn);
      const end = new Date(data.endsOn);

      if (!Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && end < start) {
        ctx.addIssue({
          path: ["endsOn"],
          code: z.ZodIssueCode.custom,
          message: "End date must be on or after the start date.",
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const PROJECT_FORM_FIELDS: Array<keyof FormValues> = [
  "name",
  "clientId",
  "status",
  "code",
  "description",
  "startsOn",
  "endsOn",
];

export function ProjectSheet({ open, onOpenChange, onComplete, project, clients }: Props) {
  const isEditing = Boolean(project);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [clients]
  );

  const initialStatus = useMemo<ProjectStatusValue>(() => {
    if (project && PROJECT_STATUS_VALUES.includes(project.status as ProjectStatusValue)) {
      return project.status as ProjectStatusValue;
    }

    return PROJECT_STATUS_OPTIONS[0]?.value ?? "active";
  }, [project]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name ?? "",
      clientId: project?.client_id ?? sortedClients[0]?.id ?? "",
      status: initialStatus,
      code: project?.code ?? "",
      description: project?.description ?? "",
      startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : "",
      endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : "",
    },
  });

  const applyServerFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return;

    PROJECT_FORM_FIELDS.forEach((field) => {
      const message = fieldErrors[field]?.[0];
      if (!message) return;
      form.setError(field, { type: "server", message });
    });
  };

  useEffect(() => {
    form.reset({
      name: project?.name ?? "",
      clientId: project?.client_id ?? sortedClients[0]?.id ?? "",
      status: project && PROJECT_STATUS_VALUES.includes(project.status as ProjectStatusValue)
        ? (project.status as ProjectStatusValue)
        : initialStatus,
      code: project?.code ?? "",
      description: project?.description ?? "",
      startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : "",
      endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : "",
    });
    form.clearErrors();
    setFeedback(null);
  }, [form, project, sortedClients, initialStatus]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);
      form.clearErrors();

      const payload = {
        id: project?.id,
        name: values.name.trim(),
        clientId: values.clientId,
        status: values.status,
        code: values.code?.trim() ? values.code.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
        startsOn: values.startsOn ? values.startsOn : null,
        endsOn: values.endsOn ? values.endsOn : null,
      };

      const result = await saveProject(payload);

      applyServerFieldErrors(result.fieldErrors);

      if (result.error) {
        setFeedback(result.error);
        toast({
          title: "Unable to save project",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isEditing ? "Project updated" : "Project created",
        description: isEditing
          ? "Changes saved successfully."
          : "The project is ready to track activity.",
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const handleArchive = () => {
    if (!project || project.deleted_at) {
      return;
    }

    const confirmed = window.confirm(
      "Archiving this project hides it from active views but keeps the history intact."
    );

    if (!confirmed) return;

    startTransition(async () => {
      setFeedback(null);
      form.clearErrors();
      const result = await softDeleteProject({ id: project.id });

      if (result.error) {
        setFeedback(result.error);
        toast({
          title: "Unable to archive project",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Project archived",
        description: "You can still find it in archived reporting.",
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const submitDisabled = isPending || (!isEditing && sortedClients.length === 0);
  const submitDisabledReason = submitDisabled
    ? isPending
      ? "Please wait for the current request to finish."
      : !isEditing && sortedClients.length === 0
        ? "Add a client before creating a project."
        : null
    : null;

  const archiveDisabled = isPending || Boolean(project?.deleted_at);
  const archiveDisabledReason =
    isEditing && archiveDisabled
      ? isPending
        ? "Please wait for the current request to finish."
        : project?.deleted_at
          ? "This project is already archived."
          : null
      : null;

  const submitLabel = isPending ? "Saving..." : isEditing ? "Save changes" : "Create project";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{isEditing ? "Edit project" : "Add project"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Adjust metadata, update its client, or archive the project."
              : "Create a project linked to an existing client so work can be tracked."}
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
                        value={field.value ?? ""}
                        placeholder="Website redesign"
                        disabled={isPending}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select
                 value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={isPending || sortedClients.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                            {client.deleted_at ? " (Archived)" : ""}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal code (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                          value={field.value ?? ""}
                        placeholder="PTS-042"
                        disabled={isPending}
                        maxLength={32}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                          value={field.value ?? ""}
                        placeholder="What success looks like"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startsOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} type="date" disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} type="date" disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {feedback ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {feedback}
              </p>
            ) : null}
            <SheetFooter className="flex items-center justify-between gap-3 px-0 pb-0 pt-6">
              {isEditing ? (
                archiveDisabledReason ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleArchive}
                        disabled={archiveDisabled}
                      >
                        {project?.deleted_at ? "Archived" : "Archive"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{archiveDisabledReason}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleArchive}
                    disabled={archiveDisabled}
                  >
                    {project?.deleted_at ? "Archived" : "Archive"}
                  </Button>
                )
              ) : (
                <span />
              )}
              {submitDisabledReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="submit" disabled={submitDisabled}>
                      {submitLabel}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{submitDisabledReason}</TooltipContent>
                </Tooltip>
              ) : (
                <Button type="submit" disabled={submitDisabled}>
                  {submitLabel}
                </Button>
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

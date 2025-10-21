'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  HOUR_BLOCK_TYPE_ENUM_VALUES,
  HOUR_BLOCK_TYPE_OPTIONS,
  type HourBlockTypeValue,
} from "@/lib/constants";
import type { Database } from "@/supabase/types/database";

import { saveHourBlock, softDeleteHourBlock } from "./actions";

type HourBlockRow = Database["public"]["Tables"]["hour_blocks"]["Row"];
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name" | "deleted_at">;

type HourBlockWithProject = HourBlockRow & { project: ProjectRow | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  hourBlock: HourBlockWithProject | null;
  projects: ProjectRow[];
};

const formSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    projectId: z.string().uuid("Select a project"),
    blockType: z.enum(HOUR_BLOCK_TYPE_ENUM_VALUES),
    hoursPurchased: z.coerce
      .number()
      .positive("Purchased hours must be greater than zero"),
    hoursConsumed: z.coerce
      .number()
      .min(0, "Consumed hours cannot be negative"),
    notes: z.string().max(1000, "Notes must be 1000 characters or fewer").optional(),
    startsOn: z.string().optional(),
    endsOn: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hoursConsumed > data.hoursPurchased) {
      ctx.addIssue({
        path: ["hoursConsumed"],
        code: z.ZodIssueCode.custom,
        message: "Consumed hours cannot exceed purchased hours.",
      });
    }

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

const HOUR_BLOCK_FORM_FIELDS: Array<keyof FormValues> = [
  "title",
  "projectId",
  "blockType",
  "hoursPurchased",
  "hoursConsumed",
  "notes",
  "startsOn",
  "endsOn",
];

export function HourBlockSheet({ open, onOpenChange, onComplete, hourBlock, projects }: Props) {
  const isEditing = Boolean(hourBlock);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const pendingReason = "Please wait for the current request to finish.";
  const missingProjectReason = "Create a project before logging hour blocks.";

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [projects]
  );

  const initialType = useMemo<HourBlockTypeValue>(() => {
    if (hourBlock && HOUR_BLOCK_TYPE_ENUM_VALUES.includes(hourBlock.block_type as HourBlockTypeValue)) {
      return hourBlock.block_type as HourBlockTypeValue;
    }

    return HOUR_BLOCK_TYPE_OPTIONS[0]?.value ?? "RETAINER";
  }, [hourBlock]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      title: hourBlock?.title ?? "",
      projectId: hourBlock?.project_id ?? sortedProjects[0]?.id ?? "",
      blockType: initialType,
      hoursPurchased: hourBlock?.hours_purchased ?? 0,
      hoursConsumed: hourBlock?.hours_consumed ?? 0,
      notes: hourBlock?.notes ?? "",
      startsOn: hourBlock?.starts_on ? hourBlock.starts_on.slice(0, 10) : "",
      endsOn: hourBlock?.ends_on ? hourBlock.ends_on.slice(0, 10) : "",
    },
  });

  const applyServerFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return;

    HOUR_BLOCK_FORM_FIELDS.forEach((field) => {
      const message = fieldErrors[field]?.[0];
      if (!message) return;
      form.setError(field, { type: "server", message });
    });
  };

  useEffect(() => {
    form.reset({
      title: hourBlock?.title ?? "",
      projectId: hourBlock?.project_id ?? sortedProjects[0]?.id ?? "",
      blockType:
        hourBlock && HOUR_BLOCK_TYPE_ENUM_VALUES.includes(hourBlock.block_type as HourBlockTypeValue)
          ? (hourBlock.block_type as HourBlockTypeValue)
          : initialType,
      hoursPurchased: hourBlock?.hours_purchased ?? 0,
      hoursConsumed: hourBlock?.hours_consumed ?? 0,
      notes: hourBlock?.notes ?? "",
      startsOn: hourBlock?.starts_on ? hourBlock.starts_on.slice(0, 10) : "",
      endsOn: hourBlock?.ends_on ? hourBlock.ends_on.slice(0, 10) : "",
    });
    form.clearErrors();
    setFeedback(null);
  }, [form, hourBlock, sortedProjects, initialType]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null);
      form.clearErrors();

      const payload = {
        id: hourBlock?.id,
        projectId: values.projectId,
        title: values.title.trim(),
        blockType: values.blockType,
        hoursPurchased: values.hoursPurchased,
        hoursConsumed: values.hoursConsumed,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        startsOn: values.startsOn ? values.startsOn : null,
        endsOn: values.endsOn ? values.endsOn : null,
      };

      const result = await saveHourBlock(payload);

      applyServerFieldErrors(result.fieldErrors);

      if (result.error) {
        setFeedback(result.error);
        toast({
          title: "Unable to save hour block",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isEditing ? "Hour block updated" : "Hour block created",
        description: isEditing
          ? "Changes saved successfully."
          : "The hour block is ready for tracking.",
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const handleDelete = () => {
    if (!hourBlock || hourBlock.deleted_at) {
      return;
    }

    const confirmed = window.confirm(
      "Deleting this block hides it from active reporting while keeping historical data intact."
    );

    if (!confirmed) return;

    startTransition(async () => {
      setFeedback(null);
      form.clearErrors();
      const result = await softDeleteHourBlock({ id: hourBlock.id });

      if (result.error) {
        setFeedback(result.error);
        toast({
          title: "Unable to delete hour block",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Hour block deleted",
        description: "It will be hidden from active tracking but remains available historically.",
      });

      onOpenChange(false);
      onComplete();
    });
  };

  const submitDisabled = isPending || (!isEditing && sortedProjects.length === 0);
  const submitDisabledReason = submitDisabled
    ? isPending
      ? "Please wait for the current request to finish."
      : !isEditing && sortedProjects.length === 0
        ? "Create a project before logging hour blocks."
        : null
    : null;

  const deleteDisabled = isPending || Boolean(hourBlock?.deleted_at);
  const deleteDisabledReason =
    isEditing && deleteDisabled
      ? isPending
        ? "Please wait for the current request to finish."
        : hourBlock?.deleted_at
          ? "This hour block is already deleted."
          : null
      : null;

  const submitLabel = isPending ? "Saving..." : isEditing ? "Save changes" : "Create hour block";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{isEditing ? "Edit hour block" : "Add hour block"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update purchased hours, annotate usage, or delete the block."
              : "Log prepaid time against a project so usage can be tracked."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-5 px-6 pb-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => {
                const disabled = isPending;
                const reason = disabled ? pendingReason : null;

                return (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="January retainer"
                          disabled={disabled}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => {
                  const disabled = isPending || sortedProjects.length === 0;
                  const reason = disabled
                    ? isPending
                      ? pendingReason
                      : sortedProjects.length === 0
                        ? missingProjectReason
                        : null
                    : null;

                  return (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={disabled}
                      >
                        <FormControl>
                          <DisabledFieldTooltip disabled={disabled} reason={reason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                          </DisabledFieldTooltip>
                        </FormControl>
                        <SelectContent>
                          {sortedProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                              {project.deleted_at ? " (Deleted)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="blockType"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={disabled}
                      >
                        <FormControl>
                          <DisabledFieldTooltip disabled={disabled} reason={reason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </DisabledFieldTooltip>
                        </FormControl>
                        <SelectContent>
                          {HOUR_BLOCK_TYPE_OPTIONS.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hoursPurchased"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>Hours purchased</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <Input
                            {...field}
                            value={field.value ?? 0}
                            type="number"
                            step="0.25"
                            min="0"
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
                name="hoursConsumed"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>Hours consumed</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <Input
                            {...field}
                            value={field.value ?? 0}
                            type="number"
                            step="0.25"
                            min="0"
                            disabled={disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startsOn"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>Start date (optional)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <Input {...field} value={field.value ?? ""} type="date" disabled={disabled} />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="endsOn"
                render={({ field }) => {
                  const disabled = isPending;
                  const reason = disabled ? pendingReason : null;

                  return (
                    <FormItem>
                      <FormLabel>End date (optional)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip disabled={disabled} reason={reason}>
                          <Input {...field} value={field.value ?? ""} type="date" disabled={disabled} />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
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
                          placeholder="Include terms, scope, or adjustments"
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
                  {submitLabel}
                </Button>
              </DisabledFieldTooltip>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

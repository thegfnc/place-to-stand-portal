'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatISO, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { ProjectWithRelations, TaskWithRelations } from "@/lib/types";

import { removeTask, saveTask } from "./actions";

const TASK_STATUSES = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "ON_DECK", label: "On Deck" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

const TASK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum([
    "BACKLOG",
    "ON_DECK",
    "IN_PROGRESS",
    "IN_REVIEW",
    "BLOCKED",
    "DONE",
    "ARCHIVED",
  ] as const),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"] as const),
  dueOn: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()),
});

type FormValues = z.infer<typeof formSchema>;

function toDateInputValue(value: string | null) {
  if (!value) return "";
  try {
    return formatISO(parseISO(value), { representation: "date" });
  } catch (error) {
    console.warn("Invalid date for task form", { value, error });
    return "";
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithRelations;
  task?: TaskWithRelations;
  canManage: boolean;
};

export function TaskSheet({ open, onOpenChange, project, task, canManage }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultValues: FormValues = useMemo(
    () => ({
      title: task?.title ?? "",
  description: task?.description ?? "",
      status: task?.status ?? "BACKLOG",
      priority: task?.priority ?? "MEDIUM",
      dueOn: toDateInputValue(task?.due_on ?? null),
  assigneeIds: task?.assignees.map((assignee) => assignee.user_id) ?? [],
    }),
    [task]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setFeedback(null);
  }, [defaultValues, form]);

  const handleSubmit = (values: FormValues) => {
    if (!canManage) return;

    startTransition(async () => {
      setFeedback(null);
      const result = await saveTask({
        id: task?.id,
        projectId: project.id,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        status: values.status,
        priority: values.priority,
        dueOn: values.dueOn ? values.dueOn : null,
        assigneeIds: values.assigneeIds,
      });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      onOpenChange(false);
    });
  };

  const handleDelete = () => {
    if (!task?.id || !canManage) return;

    startTransition(async () => {
      setFeedback(null);
      const result = await removeTask({ taskId: task.id });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{task ? "Edit task" : "Add task"}</SheetTitle>
          <SheetDescription>
            Tasks belong to <span className="font-medium">{project.name}</span>.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-1 flex-col gap-6 px-6 pb-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending || !canManage}
                      placeholder="Give the task a clear name"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      disabled={isPending || !canManage}
                      rows={4}
                      placeholder="Add helpful context for collaborators"
                    />
                  </FormControl>
                  <FormDescription>Supports basic Markdown.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending || !canManage}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
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
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending || !canManage}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
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
                name="dueOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={isPending || !canManage}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="assigneeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignees</FormLabel>
                  <div className="space-y-2 rounded-md border p-3">
                    {project.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No collaborators are assigned to this project yet.
                      </p>
                    ) : (
                      project.members.map((member) => (
                        <div key={member.user_id} className="flex items-center gap-2">
                          <Checkbox
                            checked={field.value?.includes(member.user_id) ?? false}
                            disabled={isPending || !canManage}
                            onCheckedChange={(next) => {
                              const current = field.value ?? [];

                              if (next === true) {
                                if (!current.includes(member.user_id)) {
                                  field.onChange([...current, member.user_id]);
                                }
                                return;
                              }

                              field.onChange(
                                current.filter((id: string) => id !== member.user_id)
                              );
                            }}
                          />
                          <div className="flex flex-col text-sm leading-tight">
                            <span className="font-medium">{member.user.full_name ?? member.user.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {member.role.toLowerCase()} • {member.user.email}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <FormDescription>Only members assigned to this project can be selected.</FormDescription>
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
              {task ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isPending || !canManage}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isPending || !canManage}>
                {isPending ? "Saving..." : task ? "Save changes" : "Create task"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { PROJECT_STATUS_ENUM_VALUES } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const projectSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Project name is required"),
    clientId: z.string().uuid("Select a client"),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    code: z
      .string()
      .max(32, "Code must be 32 characters or fewer")
      .nullable()
      .optional(),
    description: z
      .string()
      .max(1000, "Description must be 1000 characters or fewer")
      .nullable()
      .optional(),
    startsOn: z.string().nullable().optional(),
    endsOn: z.string().nullable().optional(),
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

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

type ProjectInput = z.infer<typeof projectSchema>;

type DeleteInput = z.infer<typeof deleteSchema>;

export async function saveProject(input: ProjectInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten();
    const message = formErrors[0] ?? "Please correct the highlighted fields.";

    return { error: message, fieldErrors };
  }

  const supabase = getSupabaseServerClient();
  const { id, name, clientId, status, code, description, startsOn, endsOn } = parsed.data;

  if (!id) {
    const { error } = await supabase.from("projects").insert({
      name,
      client_id: clientId,
      status,
      code: code ?? null,
      description: description ?? null,
      starts_on: startsOn ?? null,
      ends_on: endsOn ?? null,
      created_by: user.id,
    });

    if (error) {
      console.error("Failed to create project", error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("projects")
      .update({
        name,
        client_id: clientId,
        status,
        code: code ?? null,
        description: description ?? null,
        starts_on: startsOn ?? null,
        ends_on: endsOn ?? null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to update project", error);
      return { error: error.message };
    }
  }

  revalidatePath("/settings/projects");

  return {};
}

export async function softDeleteProject(input: DeleteInput): Promise<ActionResult> {
  await requireUser();
  const parsed = deleteSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("Failed to archive project", error);
    return { error: error.message };
  }

  revalidatePath("/settings/projects");

  return {};
}

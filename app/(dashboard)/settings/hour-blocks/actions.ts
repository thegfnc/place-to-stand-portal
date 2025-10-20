'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { HOUR_BLOCK_TYPE_ENUM_VALUES } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const hourBlockSchema = z
  .object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid("Select a project"),
    title: z.string().min(1, "Title is required"),
    blockType: z.enum(HOUR_BLOCK_TYPE_ENUM_VALUES),
    hoursPurchased: z.number().positive("Purchased hours must be greater than zero"),
    hoursConsumed: z.number().min(0, "Consumed hours cannot be negative"),
    notes: z.string().max(1000, "Notes must be 1000 characters or fewer").nullable().optional(),
    startsOn: z.string().nullable().optional(),
    endsOn: z.string().nullable().optional(),
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

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

type HourBlockInput = z.infer<typeof hourBlockSchema>;

type DeleteInput = z.infer<typeof deleteSchema>;

export async function saveHourBlock(input: HourBlockInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = hourBlockSchema.safeParse(input);

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten();
    const message = formErrors[0] ?? "Please correct the highlighted fields.";

    return { error: message, fieldErrors };
  }

  const supabase = getSupabaseServerClient();
  const {
    id,
    projectId,
    title,
    blockType,
    hoursPurchased,
    hoursConsumed,
    notes,
    startsOn,
    endsOn,
  } = parsed.data;

  if (!id) {
    const { error } = await supabase.from("hour_blocks").insert({
      project_id: projectId,
      title,
      block_type: blockType,
      hours_purchased: hoursPurchased,
      hours_consumed: hoursConsumed,
      notes: notes ?? null,
      starts_on: startsOn ?? null,
      ends_on: endsOn ?? null,
      created_by: user.id,
    });

    if (error) {
      console.error("Failed to create hour block", error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("hour_blocks")
      .update({
        project_id: projectId,
        title,
        block_type: blockType,
        hours_purchased: hoursPurchased,
        hours_consumed: hoursConsumed,
        notes: notes ?? null,
        starts_on: startsOn ?? null,
        ends_on: endsOn ?? null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to update hour block", error);
      return { error: error.message };
    }
  }

  revalidatePath("/settings/hour-blocks");

  return {};
}

export async function softDeleteHourBlock(input: DeleteInput): Promise<ActionResult> {
  await requireUser();
  const parsed = deleteSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("hour_blocks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("Failed to archive hour block", error);
    return { error: error.message };
  }

  revalidatePath("/settings/hour-blocks");

  return {};
}

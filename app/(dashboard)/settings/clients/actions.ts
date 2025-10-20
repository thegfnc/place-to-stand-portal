'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slugs can only contain lowercase letters, numbers, and dashes")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  notes: z.string().optional().transform((value) => (value ? value : null)),
});

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult = {
  error?: string;
};

type ClientInput = z.infer<typeof clientSchema>;

export async function saveClient(input: ClientInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid client payload." };
  }

  const supabase = getSupabaseServerClient();
  const { id, name, slug, notes } = parsed.data;

  if (!id) {
    const { error } = await supabase.from("clients").insert({
      name,
      slug,
      notes,
      created_by: user.id,
    });

    if (error) {
      console.error("Failed to create client", error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("clients")
      .update({ name, slug, notes })
      .eq("id", id);

    if (error) {
      console.error("Failed to update client", error);
      return { error: error.message };
    }
  }

  revalidatePath("/settings/clients");

  return {};
}

export async function softDeleteClient(input: { id: string }): Promise<ActionResult> {
  await requireUser();
  const parsed = deleteSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("Failed to archive client", error);
    return { error: error.message };
  }

  revalidatePath("/settings/clients");

  return {};
}

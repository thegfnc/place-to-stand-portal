"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/supabase/types/database";

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slugs can only contain lowercase letters, numbers, and dashes")
    .or(z.literal(""))
    .nullish()
    .transform((value) => (value ? value : null)),
  notes: z.string().nullish().transform((value) => (value ? value : null)),
});

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult = {
  error?: string;
};

type ClientInput = z.infer<typeof clientSchema>;

const UNIQUE_RETRY_LIMIT = 3;

function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "client";
}

async function slugExists(
  supabase: SupabaseClient<Database>,
  slug: string,
  options: { excludeId?: string } = {}
): Promise<boolean | PostgrestError> {
  let query = supabase.from("clients").select("id").eq("slug", slug).limit(1);

  if (options.excludeId) {
    query = query.neq("id", options.excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Failed to check slug availability", error);
    return error;
  }

  return Boolean(data);
}

async function generateUniqueSlug(
  supabase: SupabaseClient<Database>,
  base: string
): Promise<string | PostgrestError> {
  const normalizedBase = base || "client";
  let candidate = normalizedBase;
  let suffix = 2;

  // Retry until we find an available slug. In practice this usually exits early.
  while (true) {
    const exists = await slugExists(supabase, candidate);

    if (typeof exists !== "boolean") {
      return exists;
    }

    if (!exists) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
}

export async function saveClient(input: ClientInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid client payload." };
  }

  const supabase = getSupabaseServerClient();
  const { id, name, slug, notes } = parsed.data;

  const trimmedName = name.trim();

  if (!trimmedName) {
    return { error: "Name is required." };
  }

  const cleanedNotes = notes?.trim() ? notes.trim() : null;
  const providedSlug = slug?.trim() || null;

  if (!id) {
    const baseSlug = providedSlug ? toSlug(providedSlug) : toSlug(trimmedName);
    const initialSlug = await generateUniqueSlug(supabase, baseSlug);

    if (typeof initialSlug !== "string") {
      return { error: "Unable to generate client slug." };
    }

    let slugCandidate = initialSlug;
    let attempt = 0;

    while (attempt < UNIQUE_RETRY_LIMIT) {
      const { error } = await supabase.from("clients").insert({
        name: trimmedName,
        slug: slugCandidate,
        notes: cleanedNotes,
        created_by: user.id,
      });

      if (!error) {
        revalidatePath("/settings/clients");
        return {};
      }

      if (error.code !== "23505") {
        console.error("Failed to create client", error);
        return { error: error.message };
      }

      const nextSlug = await generateUniqueSlug(supabase, baseSlug);

      if (typeof nextSlug !== "string") {
        return { error: "Unable to generate client slug." };
      }

      slugCandidate = nextSlug;
      attempt += 1;
    }

    return {
      error: "Could not generate a unique slug. Please try again.",
    };
  }

  const slugToUpdate: string | null = providedSlug ? toSlug(providedSlug) : null;

  if (slugToUpdate && slugToUpdate.length < 3) {
    return { error: "Slug must be at least 3 characters." };
  }

  if (slugToUpdate) {
    const exists = await slugExists(supabase, slugToUpdate, { excludeId: id });

    if (typeof exists !== "boolean") {
      return { error: "Unable to validate slug availability." };
    }

    if (exists) {
      return { error: "Another client already uses this slug." };
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({ name: trimmedName, slug: slugToUpdate, notes: cleanedNotes })
    .eq("id", id);

  if (error) {
    console.error("Failed to update client", error);
    return { error: error.message };
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

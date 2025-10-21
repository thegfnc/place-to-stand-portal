"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendPortalInviteEmail } from "@/lib/email/send-portal-invite";

const USER_ROLES = ["ADMIN", "CONTRACTOR", "CLIENT"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(USER_ROLES),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  role: z.enum(USER_ROLES),
  password: z.string().min(8).optional(),
});

const deleteUserSchema = z.object({
  id: z.string().uuid(),
});

const restoreUserSchema = z.object({
  id: z.string().uuid(),
});

type ActionResult = {
  error?: string;
};

type CreateUserInput = z.infer<typeof createUserSchema>;
type UpdateUserInput = z.infer<typeof updateUserSchema>;

type WithOptionalPassword = UpdateUserInput & { password?: string };

function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url").slice(0, 18);
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Please supply a valid email, full name, and role." };
  }

  const { email, fullName, role } = parsed.data;
  const adminClient = getSupabaseServiceClient();
  const temporaryPassword = generateTemporaryPassword();

  const createResult = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      must_reset_password: true,
    },
  });

  if (createResult.error || !createResult.data.user) {
    console.error("Failed to create auth user", createResult.error);
    return { error: createResult.error?.message ?? "Unable to create Supabase user." };
  }

  const userId = createResult.data.user.id;
  const { error: insertError } = await adminClient.from("users").insert({
    id: userId,
    email,
    full_name: fullName,
    role,
  });

  if (insertError) {
    console.error("Failed to insert user profile", insertError);
    await adminClient.auth.admin.deleteUser(userId);
    return { error: insertError.message };
  }

  try {
    await sendPortalInviteEmail({
      to: email,
      fullName,
      temporaryPassword,
    });
  } catch (error) {
    console.error("Failed to dispatch portal invite", error);
    await adminClient.from("users").delete().eq("id", userId);
    await adminClient.auth.admin.deleteUser(userId);
    return { error: "Unable to send invite email. Please try again." };
  }

  revalidatePath("/settings/users");

  return {};
}

export async function updateUser(input: WithOptionalPassword): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = updateUserSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid user update payload." };
  }

  const { id, fullName, role, password } = parsed.data;
  const adminClient = getSupabaseServiceClient();

  const { error: profileError } = await adminClient
    .from("users")
    .update({
      full_name: fullName,
      role,
      deleted_at: null,
    })
    .eq("id", id);

  if (profileError) {
    console.error("Failed to update user profile", profileError);
    return { error: profileError.message };
  }

  const authLookup = await adminClient.auth.admin.getUserById(id);

  if (authLookup.error || !authLookup.data?.user) {
    console.error("Failed to load auth user for update", authLookup.error);
    return { error: authLookup.error?.message ?? "Unable to load Supabase user." };
  }

  const currentMetadata = (authLookup.data.user.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const nextMetadata: Record<string, unknown> = {
    ...currentMetadata,
    full_name: fullName,
    role,
    deleted_at: null,
  };

  if (password) {
    nextMetadata.must_reset_password = true;
  }

  const updatePayload: Parameters<
    typeof adminClient.auth.admin.updateUserById
  >[1] = {
    user_metadata: nextMetadata,
  };

  if (password) {
    updatePayload.password = password;
  }

  const authUpdate = await adminClient.auth.admin.updateUserById(
    id,
    updatePayload
  );

  if (authUpdate.error) {
    console.error("Failed to sync auth metadata", authUpdate.error);
    return { error: authUpdate.error.message };
  }

  revalidatePath("/settings/users");

  return {};
}

export async function softDeleteUser(input: { id: string }): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = deleteUserSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const { id } = parsed.data;
  const adminClient = getSupabaseServiceClient();
  const deletionTimestamp = new Date().toISOString();

  const { error: profileError } = await adminClient
    .from("users")
    .update({ deleted_at: deletionTimestamp })
    .eq("id", id);

  if (profileError) {
    console.error("Failed to soft delete user profile", profileError);
    return { error: profileError.message };
  }

  const adminUpdate = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: {
      deleted_at: deletionTimestamp,
    },
  });

  if (adminUpdate.error) {
    console.error("Failed to update auth record", adminUpdate.error);
    return { error: adminUpdate.error.message };
  }

  revalidatePath("/settings/users");

  return {};
}

export async function restoreUser(input: { id: string }): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = restoreUserSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid restore request." };
  }

  const { id } = parsed.data;
  const adminClient = getSupabaseServiceClient();

  const { error: profileError } = await adminClient
    .from("users")
    .update({ deleted_at: null })
    .eq("id", id);

  if (profileError) {
    console.error("Failed to restore user profile", profileError);
    return { error: profileError.message };
  }

  const adminUpdate = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: {
      deleted_at: null,
    },
  });

  if (adminUpdate.error) {
    console.error("Failed to update auth record", adminUpdate.error);
    return { error: adminUpdate.error.message };
  }

  revalidatePath("/settings/users");

  return {};
}

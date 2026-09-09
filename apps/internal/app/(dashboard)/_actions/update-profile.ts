'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, type AppUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/logger";
import {
  userPasswordChangedEvent,
  userUpdatedEvent,
} from "@/lib/activity/events";
import { sendPasswordChangedEmail } from "@/lib/email/auth-emails";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { db } from "@/lib/db";
import { users as usersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveAvatarUpdate } from "@/lib/settings/users/user-service";

type UpdateProfileInput = {
  fullName: string;
  email?: string | null;
  password?: string | null;
  avatarPath?: string | null;
  avatarRemoved?: boolean;
};

type UpdateProfileResult = {
  error?: string;
  emailConfirmationSent?: boolean;
};

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or fewer"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be 255 characters or fewer")
    .optional(),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  avatarPath: z.string().trim().min(1).max(255).optional(),
  avatarRemoved: z.boolean().optional(),
});

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const user = await requireUser();

  const cleanedInput = {
    fullName: input.fullName?.trim() ?? "",
    email: input.email?.trim() ? input.email.trim() : undefined,
    password: input.password?.trim() ? input.password.trim() : undefined,
    avatarPath: input.avatarPath?.trim() ? input.avatarPath.trim() : undefined,
    avatarRemoved: input.avatarRemoved ?? false,
  };

  const parsed = updateProfileSchema.safeParse(cleanedInput);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile update payload." };
  }

  const { fullName, email, password, avatarPath, avatarRemoved } = parsed.data;
  const isEmailChange = email && email.toLowerCase() !== user.email.toLowerCase();
  const supabase = getSupabaseServerClient();
  const supabaseAdmin = getSupabaseServiceClient();

  const avatarResolution = await resolveAvatarUpdate({
    client: supabaseAdmin,
    userId: user.id,
    currentAvatarPath: user.avatar_url ?? null,
    incomingAvatarPath: avatarPath ?? null,
    removeRequested: avatarRemoved,
  });

  if (avatarResolution.error) {
    return { error: avatarResolution.error };
  }

  const nextAvatarPath = avatarResolution.nextAvatarPath;

  try {
    await db
      .update(usersTable)
      .set({
        fullName,
        avatarUrl: nextAvatarPath,
      })
      .where(eq(usersTable.id, user.id));
  } catch (error) {
    console.error('Failed to update profile row', error);
    return { error: 'Unable to persist profile changes.' };
  }

  const userMetadata = password
    ? { full_name: fullName, must_reset_password: false, avatar_url: nextAvatarPath }
    : { full_name: fullName, avatar_url: nextAvatarPath };

  const { error: authError } = await supabase.auth.updateUser({
    data: userMetadata,
    ...(password ? { password } : {}),
    ...(isEmailChange ? { email } : {}),
  });

  if (authError) {
    console.error("Failed to update auth profile", authError);
    return { error: authError.message };
  }

  await logProfileActivity({
    user,
    fullName,
    email: isEmailChange ? email : undefined,
    nextAvatarPath,
    passwordChanged: Boolean(password),
  });

  // Goes to the address on file, not `email`: a new address is unconfirmed at
  // this point, so notifying it would tell whoever owns it about a change to an
  // account that isn't theirs yet — and leave the real owner unaware.
  if (password) {
    try {
      await sendPasswordChangedEmail(user.email);
    } catch (error) {
      console.error("Failed to send password changed email", error);
    }
  }

  revalidatePath("/settings/users");

  return { emailConfirmationSent: Boolean(isEmailChange) };
}

type ProfileActivityArgs = {
  user: AppUser;
  fullName: string;
  /** Only set when the address actually changed. */
  email: string | undefined;
  nextAvatarPath: string | null;
  passwordChanged: boolean;
};

/**
 * One row per semantic change: profile fields land on USER_UPDATED (same
 * shape as the admin edit in settings/users) and a password change gets its
 * own USER_PASSWORD_CHANGED row. Avatar is recorded as a presence flag, never
 * the storage path.
 */
async function logProfileActivity(args: ProfileActivityArgs) {
  const { user } = args;
  const changedFields: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const previousFullName = user.full_name ?? null;
  if (previousFullName !== args.fullName) {
    changedFields.push("name");
    before.fullName = previousFullName;
    after.fullName = args.fullName;
  }

  if (args.email) {
    changedFields.push("email");
    before.email = user.email;
    after.email = args.email;
  }

  const previousAvatar = user.avatar_url ?? null;
  if (previousAvatar !== args.nextAvatarPath) {
    changedFields.push("avatar");
    before.hasAvatar = Boolean(previousAvatar);
    after.hasAvatar = Boolean(args.nextAvatarPath);
  }

  const displayName = args.fullName || previousFullName || user.email;

  if (changedFields.length > 0) {
    const event = userUpdatedEvent({
      fullName: displayName,
      changedFields,
      details: { before, after },
    });

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: "USER",
      targetId: user.id,
      metadata: event.metadata,
    });
  }

  if (args.passwordChanged) {
    const event = userPasswordChangedEvent({
      fullName: displayName,
      context: "profile",
    });

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: "USER",
      targetId: user.id,
      metadata: event.metadata,
    });
  }
}

'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  deleteAvatarObject,
  ensureAvatarBucket,
  moveAvatarToUserFolder,
} from "@/lib/storage/avatar";

type UpdateProfileInput = {
  fullName: string;
  password?: string | null;
  avatarPath?: string | null;
  avatarRemoved?: boolean;
};

type UpdateProfileResult = {
  error?: string;
};

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or fewer"),
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
    password: input.password?.trim() ? input.password.trim() : undefined,
    avatarPath: input.avatarPath?.trim() ? input.avatarPath.trim() : undefined,
    avatarRemoved: input.avatarRemoved ?? false,
  };

  const parsed = updateProfileSchema.safeParse(cleanedInput);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile update payload." };
  }

  const { fullName, password, avatarPath, avatarRemoved } = parsed.data;
  const supabase = getSupabaseServerClient();
  const supabaseAdmin = getSupabaseServiceClient();

  let nextAvatarPath = user.avatar_url ?? null;

  if (avatarRemoved) {
    if (nextAvatarPath) {
      try {
        await deleteAvatarObject({ client: supabaseAdmin, path: nextAvatarPath });
      } catch (error) {
        console.error("Failed to remove existing avatar", error);
        return { error: "Unable to remove avatar. Please try again." };
      }
    }

    nextAvatarPath = null;
  } else if (avatarPath) {
    if (nextAvatarPath !== avatarPath) {
      try {
        await ensureAvatarBucket(supabaseAdmin);
        const movedPath = await moveAvatarToUserFolder({
          client: supabaseAdmin,
          path: avatarPath,
          userId: user.id,
        });

        if (nextAvatarPath && nextAvatarPath !== movedPath) {
          try {
            await deleteAvatarObject({ client: supabaseAdmin, path: nextAvatarPath });
          } catch (error) {
            console.error("Failed to delete previous avatar", error);
          }
        }

        nextAvatarPath = movedPath ?? null;
      } catch (error) {
        console.error("Failed to process avatar update", error);
        if (avatarPath) {
          try {
            await deleteAvatarObject({ client: supabaseAdmin, path: avatarPath });
          } catch (cleanupError) {
            console.error("Failed to clean up pending avatar after profile error", cleanupError);
          }
        }
        return { error: "Unable to update avatar." };
      }
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from("users")
    .update({ full_name: fullName, avatar_url: nextAvatarPath })
    .eq("id", user.id);

  if (profileError) {
    console.error("Failed to update profile row", profileError);
    return { error: profileError.message };
  }

  const userMetadata = password
    ? { full_name: fullName, must_reset_password: false, avatar_url: nextAvatarPath }
    : { full_name: fullName, avatar_url: nextAvatarPath };

  const { error: authError } = await supabase.auth.updateUser({
    data: userMetadata,
    ...(password ? { password } : {}),
  });

  if (authError) {
    console.error("Failed to update auth profile", authError);
    return { error: authError.message };
  }

  revalidatePath("/settings/users");

  return {};
}

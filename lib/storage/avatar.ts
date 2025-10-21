import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/supabase/types/database";

type AvatarBucketClient = SupabaseClient<Database>;

type MoveOptions = {
  client: AvatarBucketClient;
  path: string;
  userId: string;
};

type DeleteOptions = {
  client: AvatarBucketClient;
  path: string;
};

type GeneratePathOptions = {
  actorId: string;
  targetUserId?: string | null;
  extension: string;
};

export const AVATAR_BUCKET = "user-avatars";
export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const ACCEPTED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const PENDING_PREFIX = "avatars/pending";
const USER_PREFIX = "avatars";
const ACCEPTED_AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function ensureAvatarBucket(client: AvatarBucketClient) {
  const { data, error } = await client.storage.getBucket(AVATAR_BUCKET);

  if (data && !error) {
    return;
  }

  if (error && !error.message?.toLowerCase().includes("not found")) {
    throw error;
  }

  const { error: createError } = await client.storage.createBucket(AVATAR_BUCKET, {
    public: false,
    fileSizeLimit: `${Math.floor(MAX_AVATAR_FILE_SIZE / 1024)}KB`,
    allowedMimeTypes: [...ACCEPTED_AVATAR_MIME_TYPES],
  });

  if (createError && !createError.message?.toLowerCase().includes("already exists")) {
    throw createError;
  }
}

export function resolveAvatarExtension(mimeType: string) {
  return ACCEPTED_AVATAR_EXTENSIONS[mimeType as keyof typeof ACCEPTED_AVATAR_EXTENSIONS];
}

export function inferAvatarExtensionFromPath(path: string) {
  const segments = path.split(".");
  return segments.length > 1 ? segments.pop() ?? null : null;
}

export function generateAvatarPath({ actorId, targetUserId, extension }: GeneratePathOptions) {
  const folder = targetUserId ? `${USER_PREFIX}/${targetUserId}` : `${PENDING_PREFIX}/${actorId}`;
  return `${folder}/${randomUUID()}.${extension}`;
}

export async function moveAvatarToUserFolder({ client, path, userId }: MoveOptions) {
  if (!path) {
    return null;
  }

  if (path.startsWith(`${USER_PREFIX}/${userId}/`)) {
    return path;
  }

  const extension = inferAvatarExtensionFromPath(path) ?? "jpg";
  const destination = `${USER_PREFIX}/${userId}/${randomUUID()}.${extension}`;

  await ensureAvatarBucket(client);

  const { error } = await client.storage.from(AVATAR_BUCKET).move(path, destination);

  if (error) {
    throw error;
  }

  return destination;
}

export async function deleteAvatarObject({ client, path }: DeleteOptions) {
  if (!path) {
    return;
  }

  await ensureAvatarBucket(client);

  const { error } = await client.storage.from(AVATAR_BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}

export function canManageAvatarPath({
  actorId,
  actorRole,
  path,
  targetUserId,
}: {
  actorId: string;
  actorRole: Database["public"]["Enums"]["user_role"];
  path: string;
  targetUserId?: string | null;
}) {
  if (!path) {
    return false;
  }

  if (actorRole === "ADMIN") {
    return true;
  }

  if (targetUserId && targetUserId === actorId) {
    return true;
  }

  if (path.startsWith(`${USER_PREFIX}/${actorId}/`)) {
    return true;
  }

  if (path.startsWith(`${PENDING_PREFIX}/${actorId}/`)) {
    return true;
  }

  return false;
}

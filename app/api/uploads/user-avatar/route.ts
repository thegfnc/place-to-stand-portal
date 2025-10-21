import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  ACCEPTED_AVATAR_MIME_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_FILE_SIZE,
  canManageAvatarPath,
  deleteAvatarObject,
  ensureAvatarBucket,
  generateAvatarPath,
  resolveAvatarExtension,
} from "@/lib/storage/avatar";

const targetUserIdSchema = z.string().uuid();

export async function POST(request: Request) {
  const actor = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Avatar file is required." }, { status: 400 });
  }

  if (!ACCEPTED_AVATAR_MIME_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_MIME_TYPES)[number])) {
    return NextResponse.json({ error: "Unsupported image type. Use PNG, JPEG, WEBP, or GIF." }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    return NextResponse.json({ error: "Avatar must be 2MB or smaller." }, { status: 400 });
  }

  const targetCandidate = formData.get("targetUserId");
  let targetUserId: string | null = null;

  if (typeof targetCandidate === "string" && targetCandidate.trim().length > 0) {
    const parsedTarget = targetUserIdSchema.safeParse(targetCandidate.trim());

    if (!parsedTarget.success) {
      return NextResponse.json({ error: "Invalid target user id." }, { status: 400 });
    }

    targetUserId = parsedTarget.data;
  }

  if (targetUserId && targetUserId !== actor.id && actor.role !== "ADMIN") {
    return NextResponse.json({ error: "You do not have permission to update this avatar." }, { status: 403 });
  }

  const extension = resolveAvatarExtension(file.type);

  if (!extension) {
    return NextResponse.json({ error: "Unable to determine file extension." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();

  await ensureAvatarBucket(supabase);

  const path = generateAvatarPath({ actorId: actor.id, targetUserId, extension });
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, fileBuffer, {
    cacheControl: "86400",
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("Failed to upload avatar", uploadError);
    return NextResponse.json({ error: "Unable to upload avatar. Please try again." }, { status: 500 });
  }

  const previousCandidate = formData.get("previousPath");
  const previousPath = typeof previousCandidate === "string" && previousCandidate.trim().length > 0
    ? previousCandidate
    : null;

  if (previousPath && canManageAvatarPath({ actorId: actor.id, actorRole: actor.role, path: previousPath, targetUserId })) {
    try {
      await deleteAvatarObject({ client: supabase, path: previousPath });
    } catch (error) {
      console.error("Failed to delete previous avatar", error);
    }
  }

  return NextResponse.json({ path });
}

export async function DELETE(request: Request) {
  const actor = await requireUser();
  const payload = await request.json().catch(() => null);
  const path = typeof payload?.path === "string" ? payload.path : null;
  let targetUserId: string | null = null;

  if (typeof payload?.targetUserId === "string" && payload.targetUserId.trim().length > 0) {
    const parsed = targetUserIdSchema.safeParse(payload.targetUserId.trim());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid target user id." }, { status: 400 });
    }

    targetUserId = parsed.data;
  }

  if (!path) {
    return NextResponse.json({ error: "Avatar path is required." }, { status: 400 });
  }

  if (!canManageAvatarPath({ actorId: actor.id, actorRole: actor.role, path, targetUserId })) {
    return NextResponse.json({ error: "You do not have permission to remove this avatar." }, { status: 403 });
  }

  const supabase = getSupabaseServiceClient();

  try {
    await deleteAvatarObject({ client: supabase, path });
  } catch (error) {
    console.error("Failed to remove avatar", error);
    return NextResponse.json({ error: "Unable to remove avatar. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

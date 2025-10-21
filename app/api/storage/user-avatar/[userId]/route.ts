import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { AVATAR_BUCKET, ensureAvatarBucket } from "@/lib/storage/avatar";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(_request: Request, context: { params: { userId: string } }) {
  await requireUser();

  const parsedParams = paramsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const userId = parsedParams.data.userId;

  const { data, error } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to load avatar metadata", error);
    return NextResponse.json({ error: "Unable to load avatar." }, { status: 500 });
  }

  if (!data?.avatar_url) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  await ensureAvatarBucket(supabase);

  const { data: file, error: downloadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .download(data.avatar_url);

  if (downloadError || !file) {
    console.error("Failed to download avatar", downloadError);
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  const arrayBuffer = await file.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
    },
  });
}

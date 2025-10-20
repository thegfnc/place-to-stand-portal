import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/supabase/types/database";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export async function POST(request: Request) {
  const payload = await request.json();
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  const tokens: SessionTokens | null = payload.session ?? null;

  if (tokens) {
    await supabase.auth.setSession(tokens);
  }

  if (payload.event === "SIGNED_OUT" || payload.event === "USER_DELETED") {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ status: "ok" });
}

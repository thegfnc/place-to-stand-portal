import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/supabase/types/database";

const PUBLIC_PATHS = new Set(["/sign-in", "/unauthorized", "/forgot-password", "/reset-password"]);
const FORCE_RESET_PATH = "/force-reset-password";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.delete({ name, ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const isPublic = [...PUBLIC_PATHS].some((path) => pathname.startsWith(path));

  if (!session && !isPublic) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);

    return NextResponse.redirect(redirectUrl);
  }

  const mustResetPassword = Boolean(
    session?.user.user_metadata?.must_reset_password
  );

  if (session && mustResetPassword && !pathname.startsWith(FORCE_RESET_PATH)) {
    const resetUrl = req.nextUrl.clone();
    resetUrl.pathname = FORCE_RESET_PATH;
    resetUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);

    return NextResponse.redirect(resetUrl);
  }

  if (session && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets/).*)",
  ],
};

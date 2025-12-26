import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";
import { serverEnv } from "@/lib/env.server";

export function getSupabaseServerClient() {
  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        // Disable auto-refresh on server to prevent negative timeout warnings
        // when reading expired tokens from cookies. Token refresh is handled
        // client-side by the SupabaseListener component.
        autoRefreshToken: false,
      },
      cookies: {
        async getAll() {
          const store = await cookies();
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        async setAll(cookiesToSet) {
          try {
            const store = await cookies();
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set({ name, value, ...options });
            });
          } catch (error) {
            const cookieNames = cookiesToSet.map(({ name }) => name);
            console.warn("Unable to apply cookies on server", { cookieNames, error });
          }
        },
      },
    }
  );
}

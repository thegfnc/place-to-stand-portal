import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/supabase/types/database";
import { serverEnv } from "@/lib/env.server";

export function getSupabaseServerClient() {
  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        async get(name) {
          const store = await cookies();
          return store.get(name)?.value;
        },
        async set(name, value, options) {
          try {
            const store = await cookies();
            store.set({ name, value, ...options });
          } catch (error) {
            console.warn("Unable to set cookie on server", { name, error });
          }
        },
        async remove(name, options) {
          try {
            const store = await cookies();
            store.delete({ name, ...options });
          } catch (error) {
            console.warn("Unable to delete cookie on server", { name, error });
          }
        },
      },
    }
  );
}

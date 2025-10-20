'use client';

import { useEffect } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

interface Props {
  initialSession: SessionTokens | null;
}

export function SupabaseListener({ initialSession }: Props) {
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      const tokens = currentSession
        ? {
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
          }
        : null;

      void fetch("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: _event, session: tokens }),
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!initialSession) {
      return;
    }

    void supabase.auth.setSession({
      access_token: initialSession.access_token,
      refresh_token: initialSession.refresh_token,
    });
  }, [initialSession, supabase]);

  return null;
}

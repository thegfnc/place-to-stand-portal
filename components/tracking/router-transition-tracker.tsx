'use client';

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { startClientInteraction } from "@/lib/posthog/client";
import { INTERACTION_EVENTS } from "@/lib/posthog/types";

export function RouterTransitionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const url = search ? `${pathname}?${search}` : pathname;

    if (previousUrlRef.current === url) {
      return;
    }

    const navigationEntry =
      typeof performance !== "undefined"
        ? performance.getEntriesByType("navigation").at(-1)
        : undefined;
    const navigationType =
      navigationEntry && "type" in navigationEntry
        ? (navigationEntry as PerformanceNavigationTiming).type
        : undefined;

    const interaction = startClientInteraction(
      INTERACTION_EVENTS.ROUTER_TRANSITION,
      {
        metadata: {
          to: url,
          from: previousUrlRef.current,
          navigationType,
        },
      }
    );

    interaction.end({
      status: "success",
      to: url,
      from: previousUrlRef.current,
      navigationType,
    });

    previousUrlRef.current = url;
  }, [pathname, search]);

  return null;
}


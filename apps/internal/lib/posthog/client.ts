'use client';

import posthog from "posthog-js";

import {
  type InteractionMetadata,
  type InteractionProperties,
  startInteraction,
} from "@/lib/perf/interaction-marks";
import type {
  InteractionEventName
} from "@/lib/posthog/types";

type InteractionOptions = {
  metadata?: InteractionMetadata;
  baseProperties?: InteractionProperties;
};

export function startClientInteraction(
  name: InteractionEventName,
  options?: InteractionOptions
) {
  return startInteraction(name, {
    metadata: options?.metadata,
    onEmit: ({ duration, properties }) => {
      posthog.capture(name, {
        duration,
        ...(options?.baseProperties ?? {}),
        ...(properties ?? {}),
      });
    },
  });
}

'use client';

import posthog from "posthog-js";

import {
  type InteractionMetadata,
  type InteractionProperties,
  measureInteraction,
  startInteraction,
} from "@/lib/perf/interaction-marks";
import type {
  InteractionEventName,
  PostHogEventProperties,
} from "@/lib/posthog/types";

type InteractionOptions = {
  metadata?: InteractionMetadata;
  baseProperties?: InteractionProperties;
};

export function captureClientEvent(
  name: string,
  properties?: PostHogEventProperties
) {
  posthog.capture(name, properties);
}

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

export async function trackClientInteraction<T>(
  name: InteractionEventName,
  callback: () => Promise<T>,
  options?: InteractionOptions
): Promise<T> {
  return measureInteraction(name, callback, {
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


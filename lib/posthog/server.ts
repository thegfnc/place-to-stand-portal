import "server-only";

import { PostHog } from "posthog-node";

import { serverEnv } from "@/lib/env.server";
import {
  type InteractionMetadata,
  type InteractionProperties,
  startInteraction,
} from "@/lib/perf/interaction-marks";
import type { InteractionEventName } from "@/lib/posthog/types";

type ServerEventOptions = {
  event: string;
  properties?: Record<string, unknown>;
  distinctId?: string;
  groups?: Record<string, string | number>;
};

type ServerInteractionOptions = {
  metadata?: InteractionMetadata;
  baseProperties?: InteractionProperties;
  distinctId?: string;
  groups?: Record<string, string | number>;
};

function createPostHogClient() {
  return new PostHog(serverEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    host: serverEnv.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

async function flushAndClose(client: PostHog) {
  await client.shutdown();
}

export async function captureServerEvent(options: ServerEventOptions) {
  const client = createPostHogClient();

  try {
    client.capture({
      event: options.event,
      distinctId: options.distinctId ?? "server",
      properties: options.properties,
      groups: options.groups,
    });
  } finally {
    await flushAndClose(client);
  }
}

export async function trackServerInteraction<T>(
  name: InteractionEventName,
  callback: (client: PostHog) => Promise<T>,
  options?: ServerInteractionOptions
): Promise<T> {
  const client = createPostHogClient();
  const interaction = startInteraction(name, {
    metadata: options?.metadata,
  });

  try {
    const result = await callback(client);
    const payload = interaction.end({ status: "success" });

    client.capture({
      event: name,
      distinctId: options?.distinctId ?? "server",
      properties: {
        duration: payload.duration,
        ...(options?.baseProperties ?? {}),
        ...(payload.properties ?? {}),
      },
      groups: options?.groups,
    });

    await flushAndClose(client);
    return result;
  } catch (error) {
    const payload = interaction.end({ status: "error" });

    client.capture({
      event: name,
      distinctId: options?.distinctId ?? "server",
      properties: {
        duration: payload.duration,
        ...(options?.baseProperties ?? {}),
        ...(payload.properties ?? {}),
      },
      groups: options?.groups,
    });

    await flushAndClose(client);
    throw error;
  }
}


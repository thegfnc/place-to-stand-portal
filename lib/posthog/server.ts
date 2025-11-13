import 'server-only'

import { PostHog } from 'posthog-node'

import { serverEnv } from '@/lib/env.server'
import {
  type InteractionMetadata,
  type InteractionProperties,
  startInteraction,
} from '@/lib/perf/interaction-marks'
import type { InteractionEventName } from '@/lib/posthog/types'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'
import type { TrackServerSettingsInteractionOptions } from '@/lib/posthog/settings-types'

type ServerEventOptions = {
  event: string
  properties?: Record<string, unknown>
  distinctId?: string
  groups?: Record<string, string | number>
}

type ServerInteractionOptions = {
  metadata?: InteractionMetadata
  baseProperties?: InteractionProperties
  distinctId?: string
  groups?: Record<string, string | number>
}

type ServerInteractionHandlers<T> = {
  onSuccess?: (result: T) => InteractionProperties | void
  onError?: (error: unknown) => InteractionProperties | void
}

class SettingsMutationError<T extends { error?: string | null }> extends Error {
  constructor(
    message: string,
    readonly result: T
  ) {
    super(message)
    this.name = 'SettingsMutationError'
  }
}

function createPostHogClient() {
  return new PostHog(serverEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    host: serverEnv.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  })
}

async function flushAndClose(client: PostHog) {
  await client.shutdown()
}

export async function captureServerEvent(options: ServerEventOptions) {
  const client = createPostHogClient()

  try {
    client.capture({
      event: options.event,
      distinctId: options.distinctId ?? 'server',
      properties: options.properties,
      groups: options.groups,
    })
  } finally {
    await flushAndClose(client)
  }
}

export async function trackServerInteraction<T>(
  name: InteractionEventName,
  callback: (client: PostHog) => Promise<T>,
  options?: ServerInteractionOptions,
  handlers?: ServerInteractionHandlers<T>
): Promise<T> {
  const client = createPostHogClient()
  const interaction = startInteraction(name, {
    metadata: options?.metadata,
  })

  try {
    const result = await callback(client)
    const payload = interaction.end({ status: 'success' })
    const successProperties = handlers?.onSuccess?.(result)

    client.capture({
      event: name,
      distinctId: options?.distinctId ?? 'server',
      properties: {
        duration: payload.duration,
        ...(options?.baseProperties ?? {}),
        ...(successProperties ?? {}),
        ...(payload.properties ?? {}),
      },
      groups: options?.groups,
    })

    await flushAndClose(client)
    return result
  } catch (error) {
    const payload = interaction.end({ status: 'error' })
    const errorProperties = handlers?.onError?.(error)

    client.capture({
      event: name,
      distinctId: options?.distinctId ?? 'server',
      properties: {
        duration: payload.duration,
        ...(options?.baseProperties ?? {}),
        ...(errorProperties ?? {}),
        ...(payload.properties ?? {}),
      },
      groups: options?.groups,
    })

    await flushAndClose(client)
    throw error
  }
}

export async function trackSettingsServerInteraction<
  T extends { error?: string | null },
>(
  options: TrackServerSettingsInteractionOptions,
  callback: () => Promise<T>
): Promise<T> {
  const baseProperties: InteractionProperties = {
    entity: options.entity,
    mode: options.mode,
    targetId: options.targetId ?? null,
    layer: 'server',
    ...(options.baseProperties ?? {}),
  }

  const metadata: InteractionMetadata = {
    entity: options.entity,
    mode: options.mode,
    targetId: options.targetId ?? null,
    ...(options.metadata ?? {}),
  }

  try {
    return await trackServerInteraction(
      INTERACTION_EVENTS.SETTINGS_SAVE,
      async () => {
        const result = await callback()

        if (result?.error) {
          throw new SettingsMutationError(result.error, result)
        }

        return result
      },
      {
        baseProperties,
        metadata,
        distinctId: options.distinctId,
        groups: options.groups,
      },
      {
        onError: error => ({
          error:
            error instanceof SettingsMutationError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Unknown error',
        }),
      }
    )
  } catch (error) {
    if (error instanceof SettingsMutationError) {
      return error.result
    }

    throw error
  }
}

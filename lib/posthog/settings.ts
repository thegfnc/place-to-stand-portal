'use client';

import { startClientInteraction } from './client'
import { INTERACTION_EVENTS } from './types'
import type {
  SettingsInteractionOutcome,
  StartSettingsInteractionOptions,
} from './settings-types'

export function startSettingsInteraction(
  options: StartSettingsInteractionOptions
) {
  const targetId = options.targetId ?? null

  return startClientInteraction(INTERACTION_EVENTS.SETTINGS_SAVE, {
    metadata: {
      entity: options.entity,
      mode: options.mode,
      targetId,
      ...(options.metadata ?? {}),
    },
    baseProperties: {
      entity: options.entity,
      mode: options.mode,
      targetId,
      ...(options.baseProperties ?? {}),
    },
  })
}

export function finishSettingsInteraction(
  handle: ReturnType<typeof startSettingsInteraction>,
  outcome: SettingsInteractionOutcome
) {
  handle.end({
    status: outcome.status,
    targetId: outcome.targetId ?? null,
    error: outcome.error,
    ...(outcome.properties ?? {}),
  })
}


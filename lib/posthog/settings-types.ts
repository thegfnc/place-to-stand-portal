import type {
  InteractionMetadata,
  InteractionProperties,
} from '@/lib/perf/interaction-marks'

export type SettingsEntity = 'client' | 'project' | 'hour_block' | 'user'

export type SettingsMode = 'create' | 'edit' | 'delete' | 'restore' | 'destroy'

export type SettingsInteractionContext = {
  entity: SettingsEntity
  mode: SettingsMode
  targetId?: string | null
}

export type StartSettingsInteractionOptions = SettingsInteractionContext & {
  metadata?: InteractionMetadata
  baseProperties?: InteractionProperties
}

export type SettingsInteractionOutcome = {
  status: 'success' | 'error'
  targetId?: string | null
  error?: string | null
  properties?: InteractionProperties
}

export type TrackServerSettingsInteractionOptions =
  SettingsInteractionContext & {
    metadata?: InteractionMetadata
    baseProperties?: InteractionProperties
    distinctId?: string
    groups?: Record<string, string | number>
  }

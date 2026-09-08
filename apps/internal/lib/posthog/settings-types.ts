import type {
  InteractionMetadata,
  InteractionProperties,
} from '@/lib/perf/interaction-marks'

type SettingsEntity = 'client' | 'contact' | 'project' | 'hour_block' | 'invoice' | 'user'

type SettingsMode = 'create' | 'edit' | 'delete' | 'restore' | 'destroy' | 'send' | 'unsend' | 'void'

type SettingsInteractionContext = {
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

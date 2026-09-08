/**
 * Single source of truth for planning model tiers.
 *
 * The UI and worker only ever deal with generic tiers ('sonnet' | 'opus' | 'haiku').
 * Specific version numbers live here and are resolved to gateway model ids
 * server-side. Bumping to a newer model only requires editing this file.
 */

export const PLANNING_MODEL_TIERS = ['sonnet', 'opus', 'haiku'] as const

export type PlanningModelTier = (typeof PLANNING_MODEL_TIERS)[number]

export const DEFAULT_PLANNING_TIER: PlanningModelTier = 'sonnet'

const TIER_LABELS: Record<PlanningModelTier, string> = {
  sonnet: 'Sonnet (latest)',
  opus: 'Opus (latest)',
  haiku: 'Haiku (latest)',
}

/** Latest known gateway model id for each tier (without the provider prefix). */
const TIER_LATEST_MODEL_ID: Record<PlanningModelTier, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5',
}

/** Human-readable label for a tier, e.g. "Sonnet (latest)". */
export function getModelLabel(tier: PlanningModelTier): string {
  return TIER_LABELS[tier] ?? TIER_LABELS[DEFAULT_PLANNING_TIER]
}

/** Type guard: is the given string a valid planning tier? */
function isPlanningModelTier(value: unknown): value is PlanningModelTier {
  return (
    typeof value === 'string' &&
    PLANNING_MODEL_TIERS.includes(value as PlanningModelTier)
  )
}

/** Coerce an arbitrary value to a valid tier, falling back to the default. */
export function toPlanningModelTier(value: unknown): PlanningModelTier {
  return isPlanningModelTier(value) ? value : DEFAULT_PLANNING_TIER
}

/**
 * Resolve a tier to the gateway model id (with provider prefix) for the
 * AI SDK gateway, e.g. 'anthropic/claude-sonnet-4-6'.
 */
export function resolveGatewayModel(tier: PlanningModelTier): string {
  const id = TIER_LATEST_MODEL_ID[tier] ?? TIER_LATEST_MODEL_ID[DEFAULT_PLANNING_TIER]
  return `anthropic/${id}`
}

/** Whether a tier's model supports Anthropic extended thinking. */
export function tierSupportsThinking(tier: PlanningModelTier): boolean {
  return tier !== 'haiku'
}

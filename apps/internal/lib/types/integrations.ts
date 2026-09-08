import type { InferSelectModel } from 'drizzle-orm'

import type { projectIntegrationLinks } from '@pts/db/schema'

/**
 * Hosting providers a portal project can be linked to. Mirrors the
 * `integration_provider` Postgres enum; the slug is the URL-safe form used
 * by `/api/integrations/[provider]/...`.
 */
export type IntegrationProvider = 'VERCEL' | 'SUPABASE'

export type IntegrationProviderConfig = {
  provider: IntegrationProvider
  slug: string
  label: string
  /** What the provider calls the thing we link — used in UI copy. */
  projectNoun: string
  /** What the provider calls the owner scope of a project. */
  ownerNoun: string
  /** Where a staff member creates the personal token we store. */
  tokenSettingsUrl: string
  tokenPlaceholder: string
}

export const INTEGRATION_PROVIDERS: Record<
  IntegrationProvider,
  IntegrationProviderConfig
> = {
  VERCEL: {
    provider: 'VERCEL',
    slug: 'vercel',
    label: 'Vercel',
    projectNoun: 'project',
    ownerNoun: 'team',
    tokenSettingsUrl: 'https://vercel.com/account/settings/tokens',
    tokenPlaceholder: 'Paste a Vercel access token',
  },
  SUPABASE: {
    provider: 'SUPABASE',
    slug: 'supabase',
    label: 'Supabase',
    projectNoun: 'project',
    ownerNoun: 'organization',
    tokenSettingsUrl: 'https://supabase.com/dashboard/account/tokens',
    tokenPlaceholder: 'Paste a Supabase access token',
  },
}

export const INTEGRATION_PROVIDER_ORDER: IntegrationProvider[] = [
  'VERCEL',
  'SUPABASE',
]

export function integrationProviderFromSlug(
  slug: string
): IntegrationProvider | null {
  const match = INTEGRATION_PROVIDER_ORDER.find(
    provider => INTEGRATION_PROVIDERS[provider].slug === slug
  )
  return match ?? null
}

export function isIntegrationProvider(
  value: unknown
): value is IntegrationProvider {
  return value === 'VERCEL' || value === 'SUPABASE'
}

/** A project the staff member's token can see, as offered by the picker. */
export type ExternalProjectOption = {
  provider: IntegrationProvider
  externalId: string
  externalName: string
  ownerId: string | null
  ownerSlug: string | null
  ownerName: string | null
  url: string
  metadata: Record<string, unknown>
}

export type ProjectIntegrationLink = InferSelectModel<
  typeof projectIntegrationLinks
>

/** The slice of a link that list pages and the overview tab render. */
export type ProjectIntegrationLinkSummary = {
  id: string
  provider: IntegrationProvider
  externalId: string
  externalName: string
  ownerName: string | null
  ownerSlug: string | null
  url: string
}

export function toIntegrationLinkSummary(
  link: ProjectIntegrationLink
): ProjectIntegrationLinkSummary {
  return {
    id: link.id,
    provider: link.provider,
    externalId: link.externalId,
    externalName: link.externalName,
    ownerName: link.ownerName,
    ownerSlug: link.ownerSlug,
    url: link.url,
  }
}

/** "Team / project" or just "project" when there is no owner scope. */
export function formatIntegrationLinkLabel(
  link: Pick<ProjectIntegrationLinkSummary, 'externalName' | 'ownerName'>
): string {
  return link.ownerName
    ? `${link.ownerName} / ${link.externalName}`
    : link.externalName
}

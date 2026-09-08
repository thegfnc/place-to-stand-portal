import 'server-only'

import {
  buildSupabaseProjectUrl,
  fetchAllSupabaseProjects,
  fetchSupabaseProfile,
} from './supabase/api'
import {
  buildVercelProjectUrl,
  fetchAllVercelProjects,
  fetchVercelUser,
} from './vercel/api'
import type {
  ExternalProjectOption,
  IntegrationProvider,
} from '@/lib/types/integrations'

/** What a provider tells us about the account behind a token. */
export type ValidatedIntegrationAccount = {
  providerAccountId: string
  providerEmail: string | null
  displayName: string
  metadata: Record<string, unknown>
}

export type IntegrationProviderAdapter = {
  /** Proves the token works and identifies whose it is. */
  validateToken: (token: string) => Promise<ValidatedIntegrationAccount>
  /** Every project the token can see, normalized for the picker. */
  listProjects: (token: string) => Promise<ExternalProjectOption[]>
}

const vercelAdapter: IntegrationProviderAdapter = {
  async validateToken(token) {
    const user = await fetchVercelUser(token)
    return {
      providerAccountId: user.id,
      providerEmail: user.email,
      displayName: user.username,
      metadata: { username: user.username, name: user.name },
    }
  },

  async listProjects(token) {
    const [user, projects] = await Promise.all([
      fetchVercelUser(token),
      fetchAllVercelProjects(token),
    ])

    return projects.map(project => ({
      provider: 'VERCEL' as const,
      externalId: project.id,
      externalName: project.name,
      ownerId: project.teamId,
      ownerSlug: project.teamSlug ?? user.username,
      ownerName: project.teamName ?? `${user.username} (personal)`,
      url: buildVercelProjectUrl(project, user.username),
      metadata: {
        framework: project.framework,
        repoFullName: project.repoFullName,
        productionDomain: project.productionDomain,
      },
    }))
  },
}

const supabaseAdapter: IntegrationProviderAdapter = {
  async validateToken(token) {
    const profile = await fetchSupabaseProfile(token)
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
    return {
      providerAccountId: profile.id,
      providerEmail: profile.primaryEmail,
      displayName: fullName || profile.primaryEmail || profile.id,
      metadata: { name: fullName || null },
    }
  },

  async listProjects(token) {
    const projects = await fetchAllSupabaseProjects(token)

    return projects.map(project => ({
      provider: 'SUPABASE' as const,
      externalId: project.ref,
      externalName: project.name,
      ownerId: project.organizationId,
      ownerSlug: project.organizationSlug,
      ownerName: project.organizationName,
      url: buildSupabaseProjectUrl(project.ref),
      metadata: {
        projectId: project.id,
        region: project.region,
        status: project.status,
      },
    }))
  },
}

export const integrationProviderAdapters: Record<
  IntegrationProvider,
  IntegrationProviderAdapter
> = {
  VERCEL: vercelAdapter,
  SUPABASE: supabaseAdapter,
}

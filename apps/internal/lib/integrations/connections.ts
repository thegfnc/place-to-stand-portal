import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken, encryptToken } from '@/lib/oauth/encryption'
import {
  INTEGRATION_PROVIDERS,
  type ExternalProjectOption,
  type IntegrationProvider,
} from '@/lib/types/integrations'

import { integrationProviderAdapters } from './providers'
import { SupabaseApiError } from './supabase/api'
import { VercelApiError } from './vercel/api'

/**
 * Token-based provider connections (Vercel, Supabase). They live in
 * `oauth_connections` alongside the OAuth providers because the table is
 * already provider-generic: the token is encrypted the same way, there is
 * simply no refresh token or expiry.
 */

export class IntegrationNotConnectedError extends Error {
  constructor(provider: IntegrationProvider) {
    super(`${INTEGRATION_PROVIDERS[provider].label} is not connected.`)
    this.name = 'IntegrationNotConnectedError'
  }
}

export class InvalidIntegrationTokenError extends Error {
  constructor(provider: IntegrationProvider, detail?: string) {
    super(
      detail
        ? `${INTEGRATION_PROVIDERS[provider].label} rejected the token: ${detail}`
        : `${INTEGRATION_PROVIDERS[provider].label} rejected the token.`
    )
    this.name = 'InvalidIntegrationTokenError'
  }
}

export type IntegrationConnectionSummary = {
  id: string
  providerAccountId: string
  email: string | null
  displayName: string | null
  status: string
  connectedAt: string
  metadata: Record<string, unknown>
}

export async function listIntegrationConnections(
  userId: string,
  provider: IntegrationProvider
): Promise<IntegrationConnectionSummary[]> {
  const rows = await db
    .select({
      id: oauthConnections.id,
      providerAccountId: oauthConnections.providerAccountId,
      providerEmail: oauthConnections.providerEmail,
      displayName: oauthConnections.displayName,
      status: oauthConnections.status,
      createdAt: oauthConnections.createdAt,
      providerMetadata: oauthConnections.providerMetadata,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider),
        isNull(oauthConnections.deletedAt)
      )
    )
    .orderBy(oauthConnections.createdAt)

  return rows.map(row => ({
    id: row.id,
    providerAccountId: row.providerAccountId,
    email: row.providerEmail,
    displayName: row.displayName,
    status: row.status,
    connectedAt: row.createdAt,
    metadata: (row.providerMetadata ?? {}) as Record<string, unknown>,
  }))
}

async function listActiveTokens(userId: string, provider: IntegrationProvider) {
  const rows = await db
    .select({
      id: oauthConnections.id,
      accessToken: oauthConnections.accessToken,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider),
        eq(oauthConnections.status, 'ACTIVE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .orderBy(oauthConnections.createdAt)

  return rows.map(row => ({
    connectionId: row.id,
    token: decryptToken(row.accessToken),
  }))
}

const isAuthFailure = (error: unknown) =>
  (error instanceof VercelApiError || error instanceof SupabaseApiError) &&
  (error.status === 401 || error.status === 403)

/**
 * Validates a pasted token against the provider and stores it encrypted.
 * Re-pasting a token for an account that is already connected (or was
 * disconnected earlier) updates that row instead of creating a duplicate.
 */
export async function connectIntegrationWithToken(
  user: AppUser,
  provider: IntegrationProvider,
  token: string
): Promise<IntegrationConnectionSummary> {
  const adapter = integrationProviderAdapters[provider]

  let account
  try {
    account = await adapter.validateToken(token)
  } catch (error) {
    if (isAuthFailure(error)) {
      throw new InvalidIntegrationTokenError(provider)
    }
    throw new InvalidIntegrationTokenError(
      provider,
      error instanceof Error ? error.message : undefined
    )
  }

  const encrypted = encryptToken(token)
  const now = new Date().toISOString()

  const [existing] = await db
    .select({ id: oauthConnections.id })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, provider),
        eq(oauthConnections.providerAccountId, account.providerAccountId)
      )
    )
    .limit(1)

  const values = {
    accessToken: encrypted,
    refreshToken: null,
    accessTokenExpiresAt: null,
    scopes: [] as string[],
    status: 'ACTIVE' as const,
    providerEmail: account.providerEmail,
    displayName: account.displayName,
    providerMetadata: account.metadata,
  }

  let connectionId: string
  if (existing) {
    await db
      .update(oauthConnections)
      .set({ ...values, updatedAt: now, deletedAt: null })
      .where(eq(oauthConnections.id, existing.id))
    connectionId = existing.id
  } else {
    const [inserted] = await db
      .insert(oauthConnections)
      .values({
        userId: user.id,
        provider,
        providerAccountId: account.providerAccountId,
        ...values,
      })
      .returning({ id: oauthConnections.id })
    connectionId = inserted.id
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    source: 'SYSTEM',
    verb: 'OAUTH_CONNECTED',
    summary: `Connected ${INTEGRATION_PROVIDERS[provider].label} account (${account.displayName})`,
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: { provider, displayName: account.displayName },
  })

  return {
    id: connectionId,
    providerAccountId: account.providerAccountId,
    email: account.providerEmail,
    displayName: account.displayName,
    status: 'ACTIVE',
    connectedAt: now,
    metadata: account.metadata,
  }
}

/**
 * Soft-deletes one of the user's connections. There is no remote revocation
 * for personal tokens; the member revokes it in the provider's settings.
 */
export async function disconnectIntegration(
  user: AppUser,
  provider: IntegrationProvider,
  connectionId: string
): Promise<boolean> {
  const [connection] = await db
    .select({
      id: oauthConnections.id,
      displayName: oauthConnections.displayName,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.id, connectionId),
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, provider),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  if (!connection) {
    return false
  }

  // Drop the ciphertext too: a soft-deleted row should not keep a working
  // credential around. The column is NOT NULL, hence the empty string.
  await db
    .update(oauthConnections)
    .set({
      accessToken: '',
      refreshToken: null,
      status: 'REVOKED',
      deletedAt: new Date().toISOString(),
    })
    .where(eq(oauthConnections.id, connection.id))

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: 'OAUTH_DISCONNECTED',
    summary: `Disconnected ${INTEGRATION_PROVIDERS[provider].label} account${
      connection.displayName ? ` (${connection.displayName})` : ''
    }`,
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: { provider, displayName: connection.displayName },
  })

  return true
}

/**
 * Every external project the user's connections can see, merged across
 * accounts and de-duplicated by external id. Throws when the user has no
 * active connection for the provider.
 */
export async function listExternalProjectsForUser(
  userId: string,
  provider: IntegrationProvider
): Promise<ExternalProjectOption[]> {
  const tokens = await listActiveTokens(userId, provider)
  if (tokens.length === 0) {
    throw new IntegrationNotConnectedError(provider)
  }

  const adapter = integrationProviderAdapters[provider]
  const results = await Promise.all(
    tokens.map(({ token }) => adapter.listProjects(token))
  )

  const byExternalId = new Map<string, ExternalProjectOption>()
  results.flat().forEach(option => {
    if (!byExternalId.has(option.externalId)) {
      byExternalId.set(option.externalId, option)
    }
  })

  return Array.from(byExternalId.values()).sort((a, b) =>
    `${a.ownerName ?? ''} ${a.externalName}`.localeCompare(
      `${b.ownerName ?? ''} ${b.externalName}`
    )
  )
}

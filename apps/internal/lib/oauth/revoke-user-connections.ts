import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { revokeToken as revokeGithubToken } from '@/lib/oauth/github'
import { revokeToken as revokeGoogleToken } from '@/lib/oauth/google'

type Provider = typeof oauthConnections.$inferSelect.provider

/**
 * Best-effort revocation at the provider. Only the OAuth providers expose a
 * revocation endpoint; Vercel and Supabase personal tokens can only be
 * deleted by the member in the provider's own settings.
 */
async function revokeRemotely(provider: Provider, accessToken: string) {
  switch (provider) {
    case 'GITHUB':
      await revokeGithubToken(accessToken)
      return
    case 'GOOGLE':
      await revokeGoogleToken(accessToken)
      return
    default:
      return
  }
}

/**
 * Ends every provider connection a user holds: revokes what can be revoked
 * remotely, then drops the ciphertext so nothing decryptable remains.
 *
 * Called when a staff member is disabled, archived, or destroyed. Without
 * this, offboarding leaves live Vercel, Supabase, GitHub and Google
 * credentials in `oauth_connections`, and re-enabling the account (or any
 * future code path that resolves tokens by user id) hands them straight
 * back.
 *
 * Remote revocation failures are logged and do not block the local wipe:
 * the local credential must go regardless.
 */
export async function revokeUserOauthConnections(userId: string): Promise<{
  revoked: number
}> {
  const connections = await db
    .select({
      id: oauthConnections.id,
      provider: oauthConnections.provider,
      accessToken: oauthConnections.accessToken,
    })
    .from(oauthConnections)
    .where(
      and(eq(oauthConnections.userId, userId), isNull(oauthConnections.deletedAt))
    )

  if (connections.length === 0) {
    return { revoked: 0 }
  }

  await Promise.all(
    connections.map(async connection => {
      if (!connection.accessToken) return
      try {
        await revokeRemotely(
          connection.provider,
          decryptToken(connection.accessToken)
        )
      } catch (error) {
        console.error('[OAuth] Failed to revoke token during offboarding', {
          userId,
          connectionId: connection.id,
          provider: connection.provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  )

  const now = new Date().toISOString()
  await db
    .update(oauthConnections)
    .set({
      accessToken: '',
      refreshToken: null,
      accessTokenExpiresAt: null,
      status: 'REVOKED',
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(oauthConnections.userId, userId), isNull(oauthConnections.deletedAt))
    )

  return { revoked: connections.length }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { validateOAuthState } from '@/lib/oauth/state'
import {
  exchangeCodeForTokens,
  getGitHubUserInfo,
  GITHUB_SCOPES,
} from '@/lib/oauth/github'
import { encryptToken } from '@/lib/oauth/encryption'
import { logActivity } from '@/lib/activity/logger'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  const searchParams = request.nextUrl.searchParams

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=access_denied', request.url)
    )
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_request', request.url)
    )
  }

  // Validate state
  const isValidState = await validateOAuthState(state)
  if (!isValidState) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_state', request.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    const userInfo = await getGitHubUserInfo(tokens.access_token)

    // GitHub tokens don't expire by default (unless using expiring tokens)
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null

    // Use GitHub user ID as providerAccountId (convert number to string)
    const providerAccountId = String(userInfo.id)
    const displayName = userInfo.login // GitHub username

    // Upsert connection by providerAccountId (supports multi-account)
    await db.transaction(async tx => {
      // Check if this specific GitHub account already exists
      const [existing] = await tx
        .select({ id: oauthConnections.id })
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.userId, user.id),
            eq(oauthConnections.provider, 'GITHUB'),
            eq(oauthConnections.providerAccountId, providerAccountId)
          )
        )
        .limit(1)

      if (existing) {
        // Update existing connection (re-auth flow)
        await tx
          .update(oauthConnections)
          .set({
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            accessTokenExpiresAt: expiresAt,
            scopes: GITHUB_SCOPES,
            status: 'ACTIVE',
            providerEmail: userInfo.email,
            displayName: displayName,
            providerMetadata: {
              login: userInfo.login,
              name: userInfo.name,
              avatar_url: userInfo.avatar_url,
            },
            updatedAt: new Date().toISOString(),
            deletedAt: null, // Re-enable if previously soft-deleted
          })
          .where(eq(oauthConnections.id, existing.id))
      } else {
        // Insert new connection (new account)
        await tx.insert(oauthConnections).values({
          userId: user.id,
          provider: 'GITHUB',
          providerAccountId: providerAccountId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: GITHUB_SCOPES,
          status: 'ACTIVE',
          providerEmail: userInfo.email,
          displayName: displayName,
          providerMetadata: {
            login: userInfo.login,
            name: userInfo.name,
            avatar_url: userInfo.avatar_url,
          },
        })
      }
    })

    // Log activity
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: 'OAUTH_CONNECTED',
      summary: `Connected GitHub account (@${userInfo.login})`,
      targetType: 'SETTINGS',
      targetId: user.id,
      metadata: { provider: 'GITHUB', login: userInfo.login },
    })

    return NextResponse.redirect(
      new URL('/settings/integrations?success=github_connected', request.url)
    )
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_failed', request.url)
    )
  }
}

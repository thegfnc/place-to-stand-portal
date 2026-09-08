import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/auth/callback'
import { ensureClientAccess } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env.server'
import { getInstallationById } from '@pts/github/app-auth'

/**
 * GET /api/github/callback
 *
 * Handles the redirect from GitHub after the user installs the GitHub App.
 * Validates the state cookie, fetches installation details, and saves to DB.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const state = searchParams.get('state')
  const cookieStore = await cookies()
  const returnClientId = cookieStore.get('github_app_return_client')?.value
  const returnProjectId = cookieStore.get('github_app_return_project')?.value
  const rawReturnTo = cookieStore.get('github_app_return_to')?.value
  // The install route only stores relative paths, but the cookie is still
  // client-controlled, so re-check before resolving it against request.url.
  const returnTo = rawReturnTo ? safeRedirectPath(rawReturnTo) : null

  // Build redirect paths — returnTo cookie takes precedence, then projectId,
  // then home (there is no standalone GitHub setup page in this app; the
  // install flow always originates from a project page and supplies one).
  let errorPath: string
  let successPath: string

  if (returnTo && returnTo !== '/') {
    errorPath = `${returnTo}?github=error`
    successPath = `${returnTo}?github=installed`
  } else if (returnProjectId) {
    errorPath = `/projects/${returnProjectId}?github=error`
    successPath = `/projects/${returnProjectId}?github=installed`
  } else {
    errorPath = '/?github=error'
    successPath = '/?github=installed'
  }

  if (!installationId || !state || !returnClientId) {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  // Verify CSRF state
  const savedState = cookieStore.get('github_app_state')?.value

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  // Clear cookies
  cookieStore.delete('github_app_state')
  cookieStore.delete('github_app_return_client')
  cookieStore.delete('github_app_return_project')
  cookieStore.delete('github_app_return_to')

  // Re-validate access to the client the install was started for (defense in
  // depth — matches the check the /api/github/install route already made).
  try {
    await ensureClientAccess(user, returnClientId)
  } catch {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  const env = getEnv()

  try {
    // Fetch installation details from GitHub using App JWT
    const installation = await getInstallationById(
      parseInt(installationId, 10),
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )

    // Upsert the installation record
    const existing = await db
      .select({ id: githubAppInstallations.id, clientId: githubAppInstallations.clientId })
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.installationId, installation.id))
      .limit(1)

    if (existing.length > 0) {
      // This installation already belongs to a different client — don't
      // silently reassign ownership; surface it as an error instead.
      if (existing[0].clientId !== returnClientId) {
        return NextResponse.redirect(
          new URL(
            errorPath.includes('?')
              ? `${errorPath}&reason=already_linked`
              : `${errorPath}?reason=already_linked`,
            request.url
          )
        )
      }

      // Update existing installation
      await db
        .update(githubAppInstallations)
        .set({
          accountLogin: installation.account.login,
          accountId: installation.account.id,
          accountType: installation.account.type,
          accountAvatarUrl: installation.account.avatar_url,
          repositorySelection: installation.repository_selection,
          permissions: installation.permissions,
          events: installation.events,
          status: 'ACTIVE',
          suspendedAt: null,
          deletedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.id, existing[0].id))
    } else {
      // Create new installation
      await db.insert(githubAppInstallations).values({
        clientId: returnClientId,
        installedByUserId: user.id,
        installationId: installation.id,
        accountLogin: installation.account.login,
        accountId: installation.account.id,
        accountType: installation.account.type,
        accountAvatarUrl: installation.account.avatar_url,
        repositorySelection: installation.repository_selection,
        permissions: installation.permissions,
        events: installation.events,
      })
    }

    return NextResponse.redirect(new URL(successPath, request.url))
  } catch (error) {
    console.error('GitHub App callback error:', error)
    return NextResponse.redirect(new URL(errorPath, request.url))
  }
}

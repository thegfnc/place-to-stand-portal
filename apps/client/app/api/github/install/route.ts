import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

import { getCurrentUser } from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/auth/callback'
import { ensureClientAccess } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env.server'

/**
 * GET /api/github/install?clientId=xxx&projectId=xxx
 *
 * Generates a CSRF state token, stores it in a cookie,
 * and redirects to the GitHub App installation page.
 * Requires clientId so the callback can attribute the installation to the
 * right client explicitly, rather than guessing from the caller's memberships.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: 'clientId is required' },
      { status: 400 }
    )
  }

  await ensureClientAccess(user, clientId)

  getEnv() // validate env vars are present
  const state = nanoid(32)

  const cookieStore = await cookies()

  // Store state in a signed cookie for CSRF verification in callback
  cookieStore.set('github_app_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Store the target client so the callback attributes the installation to
  // it explicitly instead of inferring from the caller's memberships.
  cookieStore.set('github_app_return_client', clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Store projectId and optional returnTo for redirect after callback
  const projectId = url.searchParams.get('projectId')
  if (projectId) {
    cookieStore.set('github_app_return_project', projectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
  }

  // Relative paths only: the callback resolves this against the request URL,
  // so an absolute value here would become an open redirect off the portal.
  const returnTo = url.searchParams.get('returnTo')
  if (returnTo && safeRedirectPath(returnTo) === returnTo) {
    cookieStore.set('github_app_return_to', returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
  }

  // Redirect to GitHub App installation page
  const installUrl = `https://github.com/apps/place-to-stand/installations/new?state=${state}`

  return NextResponse.redirect(installUrl)
}

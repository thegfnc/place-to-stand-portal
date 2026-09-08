import 'server-only'

import { loadAppUserById, type AppUser } from '@/lib/auth/session'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const SIGN_IN_HINT = 'Run `pts login` to authenticate.'

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')

  if (!header) {
    return null
  }

  const [scheme, ...rest] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer') {
    return null
  }

  const token = rest.join(' ').trim()

  return token.length ? token : null
}

/**
 * Resolve the admin behind a CLI request from its bearer token.
 *
 * Deliberately does not use `requireUser()`: that redirects rather than
 * throwing, which Next turns into a 307 and an HTML sign-in page — a CLI
 * following it would see a 200 and no data. `getCurrentUser()` is equally
 * unusable here because it reads identity from cookies. Everything in this
 * path throws `HttpError`s so `withCliAuth` can render them as JSON.
 */
export async function resolveCliUser(request: Request): Promise<AppUser> {
  const token = readBearerToken(request)

  if (!token) {
    throw new UnauthorizedError(`Missing bearer token. ${SIGN_IN_HINT}`)
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user?.id) {
    throw new UnauthorizedError(`Invalid or expired token. ${SIGN_IN_HINT}`)
  }

  // Mirrors the proxy's force-reset gate: a user who must set a new password
  // is mid-way through provisioning and should not be acting through the API.
  if (data.user.user_metadata?.must_reset_password) {
    throw new ForbiddenError(
      'This account must reset its password in the portal before using the CLI.'
    )
  }

  const user = await loadAppUserById(data.user.id)

  // The auth record outlived the profile — deleted, disabled, or never
  // provisioned. Treat it as unauthenticated rather than leaking which.
  if (!user) {
    throw new UnauthorizedError(`Account is not active. ${SIGN_IN_HINT}`)
  }

  if (user.role !== 'ADMIN') {
    throw new ForbiddenError('The CLI is available to admin users only.')
  }

  return user
}

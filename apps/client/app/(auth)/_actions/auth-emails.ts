'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import {
  assertAuthEmailConfigured,
  sendMagicLinkEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from '@/lib/email/auth-emails'
import { allowAuthEmail } from '@/lib/auth/throttle'
import { getEnv } from '@/lib/env.server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const emailSchema = z.email()

/**
 * Both actions always report success.
 *
 * Whether an address has an account is not something an unauthenticated caller
 * gets to learn, so an unknown address, an invalid one and a delivery failure
 * are reported identically. The real reason is logged, never returned.
 */
export type AuthEmailResult = { ok: true }

const GENERIC_RESULT: AuthEmailResult = { ok: true }

export async function requestPasswordReset(
  email: string
): Promise<AuthEmailResult> {
  await dispatch(email, 'recovery')
  return GENERIC_RESULT
}

export async function requestMagicLink(
  email: string
): Promise<AuthEmailResult> {
  await dispatch(email, 'magiclink')
  return GENERIC_RESULT
}

/**
 * Confirms a password change the browser has already made.
 *
 * The reset form updates the password client-side, so the notice has to be
 * asked for rather than sent inline. The recipient comes from the session on the
 * server — never from the caller — so this can't be used to mail an arbitrary
 * address. Failures are logged only: the password did change, and the form must
 * not report otherwise.
 */
export async function notifyPasswordChanged(): Promise<AuthEmailResult> {
  try {
    const {
      data: { user },
      error,
    } = await getSupabaseServerClient().auth.getUser()

    if (error || !user?.email) {
      console.error('Failed to resolve user for password changed email', error)
      return GENERIC_RESULT
    }

    await sendPasswordChangedEmail(user.email)
  } catch (cause) {
    console.error('Unable to send password changed email', cause)
  }

  return GENERIC_RESULT
}

/**
 * Mints a one-time token and mails it with our own template.
 *
 * This path uses the admin API, which does *not* consume Supabase's per-hour
 * `email_sent` rate limit, so `allowAuthEmail` provides the server-side brake
 * (per address and per IP) that the sign-in page's client-side cooldown only
 * pretends to.
 */
async function dispatch(
  email: string,
  type: 'recovery' | 'magiclink'
): Promise<void> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase())

  if (!parsed.success) return

  // Deliberately outside the catch below. That catch exists to make an unknown
  // address indistinguishable from a known one; a mailer that isn't configured
  // is neither, and letting it fall through there turns a broken deployment into
  // a cheerful "check your inbox" with nothing behind it.
  assertAuthEmailConfigured()

  // Same silent return as an unknown address: the caller must not be able to
  // tell "throttled" from "no account".
  if (!(await allowAuthEmail(parsed.data))) return

  try {
    const { data, error } = await getSupabaseServiceClient().auth.admin.generateLink(
      { type, email: parsed.data }
    )

    const tokenHash = data?.properties?.hashed_token

    if (error || !tokenHash) {
      // Expected whenever the address has no account — indistinguishable from a
      // real failure on purpose, and the caller is told nothing either way.
      console.error(`Failed to generate ${type} link`, error)
      return
    }

    const actionLink = buildConfirmLink(await resolveOrigin(), tokenHash, type)

    if (type === 'recovery') {
      await sendPasswordResetEmail(parsed.data, actionLink)
      return
    }

    await sendMagicLinkEmail(parsed.data, actionLink)
  } catch (cause) {
    console.error(`Unable to send ${type} email`, cause)
  }
}

/**
 * Points at our own `/auth/confirm` rather than `properties.action_link`.
 *
 * Supabase's link completes the implicit flow and returns the session in the URL
 * fragment, which browsers never send to the server — a route handler sees no
 * credentials and bounces to /sign-in. Verifying the token hash server-side is
 * the only form that can set a cookie. It also takes these links off Supabase's
 * redirect allowlist entirely, which is what made password reset fall back to
 * the sign-in screen: `/force-reset-password` was never an allowed target.
 *
 * `/auth/confirm` already routes `recovery` to the reset form, so no
 * `redirect_to` is needed for that type.
 */
function buildConfirmLink(
  origin: string,
  tokenHash: string,
  type: 'recovery' | 'magiclink'
): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type })

  return `${origin}/auth/confirm?${params}`
}

/**
 * The request origin is the portal itself, so it is the most accurate value and
 * needs no configuration. `APP_BASE_URL` is the fallback for contexts without
 * request headers.
 */
async function resolveOrigin(): Promise<string> {
  const origin = (await headers()).get('origin')

  if (origin) return origin

  const { APP_BASE_URL } = getEnv()

  if (!APP_BASE_URL) {
    throw new Error(
      'Cannot build an auth link: no request origin and APP_BASE_URL is unset.'
    )
  }

  return APP_BASE_URL
}

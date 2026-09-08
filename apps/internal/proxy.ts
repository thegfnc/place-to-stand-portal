import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/lib/supabase/types'

const PUBLIC_PATHS = new Set([
  '/sign-in',
  '/unauthorized',
  '/forgot-password',
  '/reset-password',
  // Auth callbacks must run before a session exists — magic link (token_hash)
  // and OAuth (PKCE code) both land here carrying something to exchange. Gating
  // them on authentication bounces the visitor to /sign-in before the exchange
  // can happen, which reads as "the link did nothing". The routes verify their
  // own tokens.
  '/auth/',
  // Reached only after being signed out (strict provisioning), so by definition
  // the visitor is unauthenticated when it renders.
  '/account-not-set-up',
  '/share/',
  '/api/integrations/leads-intake',
  '/api/integrations/audit-responses',
  '/api/integrations/contact-submissions',
  '/api/integrations/stripe',
  '/api/cron/',
  '/api/public/',
  // Machine surface for the `pts` CLI. Authenticates by bearer token rather
  // than a session cookie, so the cookie gate here would 302 every request to
  // /sign-in and hand the caller an HTML page instead of JSON. Every route
  // under this prefix must resolve its own user via `withCliAuth`
  // (lib/cli/handler.ts) — there is no edge-level fallback.
  '/api/cli/',
])
const FORCE_RESET_PATH = '/force-reset-password'

/**
 * Check authentication using Supabase Auth
 */
async function checkSupabaseAuth(req: NextRequest): Promise<{
  isAuthenticated: boolean
  mustResetPassword: boolean
  response: NextResponse
}> {
  const res = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies
            .getAll()
            .map(({ name, value }) => ({ name, value }))
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // AuthSessionMissingError is expected for unauthenticated users - don't log it
  if (userError && userError.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase user in middleware', userError)
  }

  return {
    isAuthenticated: Boolean(user),
    mustResetPassword: Boolean(user?.user_metadata?.must_reset_password),
    response: res,
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Cross-site request forgery guard for cookie-authenticated route handlers.
 *
 * Server actions get an Origin check from Next.js itself; route handlers do
 * not. The Supabase cookie is SameSite=Lax, which already keeps it off
 * cross-site POSTs, so this is defence in depth: a state-changing request
 * that arrives with an Origin header from another site is rejected outright.
 * Requests without an Origin (same-origin fetches in older browsers, curl,
 * the CLI) pass through to their own auth.
 */
function isCrossSiteMutation(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return false
  const origin = req.headers.get('origin')
  if (!origin) return false

  // Compare hosts rather than full origins: the local portless proxy and
  // Vercel's edge terminate TLS, so the scheme the browser saw and the one
  // this request carries can legitimately differ.
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return true
  }
  const requestHost =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return originHost !== requestHost
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const isPublic = [...PUBLIC_PATHS].some(path => pathname.startsWith(path))

  if (!isPublic && isCrossSiteMutation(req)) {
    return NextResponse.json(
      { ok: false, error: 'Cross-site request rejected' },
      { status: 403 }
    )
  }
  const { isAuthenticated, mustResetPassword, response } =
    await checkSupabaseAuth(req)

  if (!isAuthenticated && !isPublic) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sign-in'
    redirectUrl.searchParams.set(
      'redirect',
      req.nextUrl.pathname + req.nextUrl.search
    )

    return NextResponse.redirect(redirectUrl)
  }

  if (
    isAuthenticated &&
    mustResetPassword &&
    !pathname.startsWith(FORCE_RESET_PATH)
  ) {
    const resetUrl = req.nextUrl.clone()
    resetUrl.pathname = FORCE_RESET_PATH
    resetUrl.searchParams.set(
      'redirect',
      req.nextUrl.pathname + req.nextUrl.search
    )

    return NextResponse.redirect(resetUrl)
  }

  if (isAuthenticated && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return response
}

export const config = {
  matcher: [
    // `icon` and `apple-icon` are the generated metadata routes (app/icon.tsx,
    // app/apple-icon.tsx). They carry no file extension, so without naming them
    // here they get gated like a page: a signed-out tab's icon request redirects
    // to /sign-in, the browser falls back to the static favicon.ico, and the DEV
    // band silently disappears from the sign-in screen only.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|assets/|relay-HVAq/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
}

import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { getGoogleAuthUrl } from '@/lib/oauth/google'
import { generateOAuthState } from '@/lib/oauth/state'

export async function GET() {
  // Ensure user is logged in
  await requireUser()

  const state = await generateOAuthState()
  const authUrl = getGoogleAuthUrl(state)

  return NextResponse.redirect(authUrl)
}

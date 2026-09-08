import { formatExpiryWindow, renderEmail, type RenderedEmail } from '../layout'

export type PortalInviteEmailArgs = {
  fullName?: string | null
  /** One-time link from `admin.generateLink({ type: 'magiclink' })`. */
  actionLink: string
  /** The client portal's sign-in page, for when the link has expired. */
  signInUrl: string
  /** Mirrors Supabase's `otp_expiry`, so the copy can't promise the wrong window. */
  expiresInMinutes: number
  replyTo: string
}

/**
 * Client portal invite.
 *
 * Carries a one-time sign-in link rather than a password. The account does
 * have a password credential — generated at create time and never disclosed —
 * so "forgot password" still works as a recovery path for clients who choose a
 * passwordless sign-in method during onboarding.
 */
export function portalInviteEmail({
  fullName,
  actionLink,
  signInUrl,
  expiresInMinutes,
  replyTo,
}: PortalInviteEmailArgs): RenderedEmail {
  const greeting = fullName?.trim() ? `Hi ${fullName.trim()}, you've` : "You've"

  return renderEmail("You're invited to the Place To Stand portal", {
    preheader: 'Your sign-in link for the Place To Stand client portal.',
    heading: "You're invited to the client portal",
    paragraphs: [
      `${greeting} been invited to the Place To Stand client portal. Use the button below to sign in — no password needed.`,
      "Once you're in, you can choose how you'd like to sign in from then on: a password, your Google account, or an emailed link each time.",
    ],
    action: {
      label: 'Sign in to the portal',
      url: actionLink,
    },
    // The link inherits Supabase's `otp_expiry`. Rather than widening that
    // window, the copy points at the sign-in page, where "email me a sign-in
    // link" issues a fresh one — the account already exists by this point.
    note: `This link works once and expires in ${formatExpiryWindow(expiresInMinutes)}. If it has, go to ${signInUrl} and choose "Email me a sign-in link" for a fresh one.`,
    replyTo,
  })
}

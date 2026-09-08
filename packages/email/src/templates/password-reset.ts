import { formatExpiryWindow, renderEmail, type RenderedEmail } from '../layout'

export type PasswordResetEmailArgs = {
  /** One-time link from `admin.generateLink({ type: 'recovery' })`. */
  actionLink: string
  /** Where the link lands, in words — "the client portal". */
  destination: string
  /** Mirrors Supabase's `otp_expiry`, so the copy can't promise the wrong window. */
  expiresInMinutes: number
  replyTo: string
}

export function passwordResetEmail({
  actionLink,
  destination,
  expiresInMinutes,
  replyTo,
}: PasswordResetEmailArgs): RenderedEmail {
  return renderEmail('Reset your Place To Stand password', {
    preheader: `Choose a new password for ${destination}.`,
    heading: 'Reset your password',
    paragraphs: [
      `Someone asked to reset the password for your account on ${destination}. If that was you, use the button below to choose a new one.`,
      "If it wasn't you, nothing has changed yet — your current password still works, and you can safely ignore this message.",
    ],
    action: {
      label: 'Choose a new password',
      url: actionLink,
    },
    // Reset is the flow where a stale link is most common — people find the mail
    // hours later — so the copy says what to do next, not only when it dies.
    note: `This link works once and expires in ${formatExpiryWindow(expiresInMinutes)}. If it has already expired, request a new one from the sign-in page.`,
    replyTo,
  })
}

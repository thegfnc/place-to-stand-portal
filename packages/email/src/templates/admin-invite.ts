import { renderEmail, type RenderedEmail } from '../layout'

export type AdminInviteEmailArgs = {
  /** The address the account was created with — repeated in the body. */
  email: string
  fullName?: string | null
  temporaryPassword: string
  /** The admin portal's sign-in page — never the client portal. */
  signInUrl: string
  replyTo: string
}

/**
 * Admin invite.
 *
 * Admins get a temporary password and are forced through a password reset on
 * first sign-in. Kept separate from the client invite so neither carries a
 * field the other ignores.
 */
export function adminInviteEmail({
  email,
  fullName,
  temporaryPassword,
  signInUrl,
  replyTo,
}: AdminInviteEmailArgs): RenderedEmail {
  const greeting = fullName?.trim() ? `Hi ${fullName.trim()}, you've` : "You've"

  return renderEmail("You're invited to the Place To Stand portal", {
    preheader: 'Your sign-in details for the Place To Stand admin portal.',
    heading: "You've been given access",
    paragraphs: [
      `${greeting} been given access to the Place To Stand admin portal. Sign in with the details below.`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      "For security, you'll be asked to create a new password the first time you sign in.",
    ],
    action: {
      label: 'Sign in to the portal',
      url: signInUrl,
    },
    replyTo,
  })
}

import { renderEmail, type RenderedEmail } from '../layout'

export type PasswordChangedEmailArgs = {
  /** Where the password now applies, in words — "the client portal". */
  destination: string
  replyTo: string
}

/**
 * Sent after a password change has already taken effect.
 *
 * Replaces Supabase's stock `password_changed` notification, which was the last
 * piece of auth mail still going out unbranded and still pointing recipients at
 * a "support" desk we don't run. It carries no link on purpose: the one thing a
 * recipient should do if this wasn't them is write to a human, and a button in
 * a message about a security event is exactly the shape of the phishing this
 * flow already had trouble being mistaken for.
 */
export function passwordChangedEmail({
  destination,
  replyTo,
}: PasswordChangedEmailArgs): RenderedEmail {
  return renderEmail('Your Place To Stand password was changed', {
    preheader: `The password for your account on ${destination} was just changed.`,
    label: 'Password changed',
    heading: 'Your password was changed',
    paragraphs: [
      `The password for your account on ${destination} was just changed. If that was you, there's nothing to do — use your new password the next time you sign in.`,
    ],
    footerLead: "If you didn't make this change, please contact us at",
    replyTo,
  })
}

import 'server-only'

import {
  adminInviteEmail,
  magicLinkEmail,
  passwordChangedEmail,
  passwordResetEmail,
  portalInviteEmail,
  type RenderedEmail,
} from '@pts/email'
import { serverEnv } from '@/lib/env.server'

export type EmailPortal = 'internal' | 'client'

type EmailTemplateVariant = {
  /** Which portal's copy of the template this is, e.g. "Admin". */
  label: string
  sample: RenderedEmail
}

type EmailTemplateStatus = 'active' | 'disabled'

export type EmailTemplateEntry = {
  id: string
  name: string
  description: string
  /** Whether any code path actually sends it today. */
  status: EmailTemplateStatus
  portals: EmailPortal[]
  triggers: string[]
  recipient: string
  from: string
  replyTo: string
  delivery: string
  attachments: string | null
  /** Where the copy lives, relative to the repo root. */
  source: string
  variants: EmailTemplateVariant[]
}

/**
 * Mirrors the wrappers in `lib/email/auth-emails.ts` (internal) and
 * `apps/client/lib/email/auth-emails.ts` (client). Both read Supabase's
 * `otp_expiry` (3600s) so the copy states the window the token actually has.
 */
const LINK_EXPIRY_MINUTES = 60
const INTERNAL_DESTINATION = 'the Place To Stand admin portal'
const CLIENT_DESTINATION = 'the Place To Stand client portal'

const INTERNAL_SDK_DELIVERY =
  'Resend SDK through lib/email/send.ts; routed to Mailpit outside production'
const CLIENT_HTTP_DELIVERY =
  'Resend HTTP API through the @pts/email transport; routed to Mailpit outside production'

/**
 * Renders every outbound email with placeholder data so the catalog page can
 * show exactly what recipients get. Sample values are obviously fake on
 * purpose — nothing here should be mistaken for a real link or credential.
 */
export function buildEmailTemplateCatalog(): EmailTemplateEntry[] {
  const from = `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`
  const replyTo = serverEnv.RESEND_REPLY_TO_EMAIL
  const internalOrigin = new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  const clientOrigin = serverEnv.CLIENT_PORTAL_URL

  const authVariants = (
    render: (destination: string, origin: string) => RenderedEmail
  ): EmailTemplateVariant[] => [
    {
      label: 'Admin',
      sample: render(INTERNAL_DESTINATION, internalOrigin),
    },
    {
      label: 'Client',
      sample: render(CLIENT_DESTINATION, clientOrigin),
    },
  ]

  return [
    {
      id: 'magic-link',
      status: 'active',
      name: 'Magic link sign-in',
      description:
        'A one-time sign-in link. The link itself comes from Supabase; only the wrapper email is ours.',
      portals: ['internal', 'client'],
      triggers: ['"Email me a sign-in link" on either sign-in page'],
      recipient:
        'The address entered on the sign-in form, only if an account exists',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/magic-link.ts',
      variants: authVariants((destination, origin) =>
        magicLinkEmail({
          actionLink: `${origin}/auth/confirm?token_hash=sample-token&type=magiclink`,
          destination,
          expiresInMinutes: LINK_EXPIRY_MINUTES,
          replyTo,
        })
      ),
    },
    {
      id: 'password-reset',
      status: 'active',
      name: 'Password reset',
      description:
        'Recovery link for the forgot-password flow. Replaces the stock Supabase reset email, which was getting flagged as phishing.',
      portals: ['internal', 'client'],
      triggers: ['Forgot-password form on either portal'],
      recipient: 'The address entered on the form, only if an account exists',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/password-reset.ts',
      variants: authVariants((destination, origin) =>
        passwordResetEmail({
          actionLink: `${origin}/auth/confirm?token_hash=sample-token&type=recovery`,
          destination,
          expiresInMinutes: LINK_EXPIRY_MINUTES,
          replyTo,
        })
      ),
    },
    {
      id: 'password-changed',
      status: 'active',
      name: 'Password changed',
      description:
        'Confirmation sent after a password change has already taken effect. Carries no link on purpose. Supabase’s own notice is disabled so only one message lands.',
      portals: ['internal', 'client'],
      triggers: [
        'Admin: forced password reset, or changing the password from the profile sheet',
        'Client: forced password reset, or setting a password in the onboarding wizard',
      ],
      recipient: 'The signed-in user’s email',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/password-changed.ts',
      variants: authVariants(destination =>
        passwordChangedEmail({ destination, replyTo })
      ),
    },
    {
      id: 'portal-invite',
      status: 'active',
      name: 'Client portal invite',
      description:
        'Welcomes a new client portal user with a one-time sign-in link. Sent from the admin portal, but lands with client contacts.',
      portals: ['internal'],
      triggers: [
        'Promoting a contact to a portal user',
        'Creating a CLIENT-role user under Settings → Users',
      ],
      recipient: 'The new portal user',
      from,
      replyTo,
      delivery: INTERNAL_SDK_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/portal-invite.ts',
      variants: [
        {
          label: 'Client',
          sample: portalInviteEmail({
            fullName: 'Jordan Sample',
            actionLink: `${clientOrigin}/auth/confirm?token_hash=sample-token&type=magiclink`,
            signInUrl: `${clientOrigin}/sign-in`,
            expiresInMinutes: LINK_EXPIRY_MINUTES,
            replyTo,
          }),
        },
      ],
    },
    {
      id: 'admin-invite',
      status: 'active',
      name: 'Admin invite',
      description:
        'Gives a new admin a temporary password. They are forced through a password reset on first sign-in.',
      portals: ['internal'],
      triggers: ['Creating an ADMIN-role user under Settings → Users'],
      recipient: 'The new admin user',
      from,
      replyTo,
      delivery: INTERNAL_SDK_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/admin-invite.ts',
      variants: [
        {
          label: 'Admin',
          sample: adminInviteEmail({
            email: 'new.admin@example.com',
            fullName: 'Jordan Sample',
            temporaryPassword: 'sample-temporary-password',
            signInUrl: `${internalOrigin}/sign-in`,
            replyTo,
          }),
        },
      ],
    },
  ]
}

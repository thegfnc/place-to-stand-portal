import "server-only";

import {
  adminInviteEmail,
  portalInviteEmail,
  type RenderedEmail,
} from "@pts/email";

import { serverEnv } from "@/lib/env.server";
import { sendEmail } from "@/lib/email/send";

/** Matches `otp_expiry` in `supabase/config.toml` (3600s). */
const LINK_EXPIRY_MINUTES = 60;

export type SendPortalInviteArgs = {
  to: string;
  fullName?: string | null;
  actionLink: string;
};

/** Client portal invite: a one-time sign-in link into the client portal. */
export async function sendPortalInviteEmail({
  to,
  fullName,
  actionLink,
}: SendPortalInviteArgs) {
  await send(
    to,
    portalInviteEmail({
      fullName,
      actionLink,
      signInUrl: `${serverEnv.CLIENT_PORTAL_URL}/sign-in`,
      expiresInMinutes: LINK_EXPIRY_MINUTES,
      replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    })
  );
}

export type SendAdminInviteArgs = {
  to: string;
  fullName?: string | null;
  temporaryPassword: string;
  /** Base URL of the admin app — NOT the client portal. */
  baseUrl: string;
};

/** Admin invite: a temporary password, reset on first sign-in. */
export async function sendAdminInviteEmail({
  to,
  fullName,
  temporaryPassword,
  baseUrl,
}: SendAdminInviteArgs) {
  await send(
    to,
    adminInviteEmail({
      email: to,
      fullName,
      temporaryPassword,
      signInUrl: `${baseUrl}/sign-in`,
      replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    })
  );
}

async function send(to: string, { subject, text, html }: RenderedEmail) {
  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject,
    text,
    html,
  });
}

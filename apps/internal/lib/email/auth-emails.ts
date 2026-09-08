import "server-only";

import {
  magicLinkEmail,
  passwordChangedEmail,
  passwordResetEmail,
  type RenderedEmail,
} from "@pts/email";

import { serverEnv } from "@/lib/env.server";
import { sendEmail } from "@/lib/email/send";

/**
 * Matches `otp_expiry` in `supabase/config.toml` (3600s). The templates state
 * the window in words, so a drift here makes the mail lie about how long the
 * recipient has.
 */
const LINK_EXPIRY_MINUTES = 60;

/** How the admin portal refers to itself in mail — not the client portal. */
const DESTINATION = "the Place To Stand admin portal";

type AuthEmailTemplate = (args: {
  actionLink: string;
  destination: string;
  expiresInMinutes: number;
  replyTo: string;
}) => RenderedEmail;

export async function sendPasswordResetEmail(to: string, actionLink: string) {
  await send(to, actionLink, passwordResetEmail);
}

export async function sendMagicLinkEmail(to: string, actionLink: string) {
  await send(to, actionLink, magicLinkEmail);
}

/**
 * Confirms a password change that has already happened.
 *
 * Replaces Supabase's own `password_changed` notification, which is disabled so
 * the two can't both land. Every path that changes a password is responsible for
 * calling this — see `supabase/config.toml`.
 */
export async function sendPasswordChangedEmail(to: string) {
  await deliver(
    to,
    passwordChangedEmail({
      destination: DESTINATION,
      replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    })
  );
}

async function send(
  to: string,
  actionLink: string,
  template: AuthEmailTemplate
) {
  await deliver(
    to,
    template({
      actionLink,
      destination: DESTINATION,
      expiresInMinutes: LINK_EXPIRY_MINUTES,
      replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    })
  );
}

async function deliver(to: string, email: RenderedEmail) {
  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

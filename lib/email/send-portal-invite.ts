import "server-only";

import { serverEnv } from "@/lib/env.server";
import { getResendClient } from "@/lib/email/resend";

export type SendPortalInviteArgs = {
  to: string;
  fullName?: string | null;
  temporaryPassword: string;
};

export async function sendPortalInviteEmail({
  to,
  fullName,
  temporaryPassword,
}: SendPortalInviteArgs) {
  const resend = getResendClient();
  const greetingName = fullName?.trim() || "there";
  const subject = "You're invited to the Place To Stand portal";
  const intro = `Hi ${greetingName},`;
  const copy = [
    intro,
    "",
    "You've been invited to the Place To Stand client portal.",
    "Use the details below to sign in:",
    "",
    `Email: ${to}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "For security, you'll be asked to create a new password when you first log in.",
    "",
    "Go to https://portal.placetostandagency.com or the link provided by your account manager to get started.",
    "",
    "If you weren't expecting this message, please reach out to hello@placetostandagency.com.",
    "",
    "Talk soon,",
    "The Place To Stand Team",
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hi ${greetingName},</p>
      <p>You've been invited to the Place To Stand client portal. Use the details below to sign in:</p>
      <ul>
        <li><strong>Email:</strong> ${to}</li>
        <li><strong>Temporary password:</strong> ${temporaryPassword}</li>
      </ul>
      <p>For security, you'll be asked to create a new password when you first log in.</p>
      <p>
        Go to <a href="https://portal.placetostandagency.com">portal.placetostandagency.com</a> or use the link shared by your account manager to get started.
      </p>
      <p>If you weren't expecting this message, please reach out to <a href="mailto:${serverEnv.RESEND_REPLY_TO_EMAIL}">${serverEnv.RESEND_REPLY_TO_EMAIL}</a>.</p>
      <p>Talk soon,<br />The Place To Stand Team</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject,
    text: copy,
    html,
  });

  if (error) {
    throw error;
  }
}

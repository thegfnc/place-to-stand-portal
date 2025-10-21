import "server-only";

import { Resend } from "resend";

import { serverEnv } from "@/lib/env.server";

let client: Resend | null = null;

export function getResendClient() {
  if (!client) {
    client = new Resend(serverEnv.RESEND_API_KEY);
  }

  return client;
}

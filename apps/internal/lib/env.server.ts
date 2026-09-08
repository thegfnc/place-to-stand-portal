import 'server-only'

import { z } from 'zod'

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),
  RESEND_REPLY_TO_EMAIL: z.email(),
  AI_GATEWAY_API_KEY: z.string().min(1),
  APP_BASE_URL: z.url().optional(),
  // AES-256-GCM needs exactly 32 key bytes. Checking the decoded length here
  // fails at boot instead of on the first token encrypt.
  OAUTH_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine(value => Buffer.from(value, 'base64').length === 32, {
      message:
        'OAUTH_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)',
    }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_CHAT_SALES_WEBHOOK_URL: z.string().url().optional(),
  CLIENT_PORTAL_URL: z.url(),
  AUDIT_INTAKE_TOKEN: z.string().min(1).optional(),
  CONTACT_INTAKE_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
})

// Helper to convert empty strings to undefined for optional env vars
function emptyToUndefined(val: string | undefined): string | undefined {
  return val === '' ? undefined : val
}

export const serverEnv = schema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_REPLY_TO_EMAIL: process.env.RESEND_REPLY_TO_EMAIL,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  APP_BASE_URL: process.env.APP_BASE_URL,
  OAUTH_TOKEN_ENCRYPTION_KEY: process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GITHUB_CLIENT_ID: emptyToUndefined(process.env.GITHUB_CLIENT_ID),
  GITHUB_CLIENT_SECRET: emptyToUndefined(process.env.GITHUB_CLIENT_SECRET),
  GITHUB_REDIRECT_URI: emptyToUndefined(process.env.GITHUB_REDIRECT_URI),
  STRIPE_SECRET_KEY: emptyToUndefined(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: emptyToUndefined(process.env.STRIPE_WEBHOOK_SECRET),
  GITHUB_APP_ID: emptyToUndefined(process.env.GITHUB_APP_ID),
  GITHUB_APP_PRIVATE_KEY: emptyToUndefined(process.env.GITHUB_APP_PRIVATE_KEY),
  GOOGLE_CHAT_SALES_WEBHOOK_URL: emptyToUndefined(
    process.env.GOOGLE_CHAT_SALES_WEBHOOK_URL
  ),
  CLIENT_PORTAL_URL: process.env.CLIENT_PORTAL_URL,
  AUDIT_INTAKE_TOKEN: emptyToUndefined(process.env.AUDIT_INTAKE_TOKEN),
  CONTACT_INTAKE_TOKEN: emptyToUndefined(process.env.CONTACT_INTAKE_TOKEN),
  CRON_SECRET: emptyToUndefined(process.env.CRON_SECRET),
})

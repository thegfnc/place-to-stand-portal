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
  OAUTH_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'Encryption key must be at least 32 characters (base64)'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),
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
})

import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

/**
 * Display names for every `oauth_provider` value. Kept local so the event
 * builders stay free of server-only integration modules.
 */
const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
  VERCEL: 'Vercel',
  SUPABASE: 'Supabase',
}

const providerLabel = (provider: string) =>
  PROVIDER_LABELS[provider] ?? provider

const withAccount = (accountLabel: string | null | undefined) =>
  accountLabel ? ` (${accountLabel})` : ''

/**
 * A provider account was connected for the first time. Re-authorising an
 * account that is already connected must not emit this event.
 */
export const oauthConnectedEvent = (args: {
  provider: string
  /** GitHub login, Google email, or the token account's display name. */
  accountLabel: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.OAUTH_CONNECTED,
  summary: `Connected ${providerLabel(args.provider)} account${withAccount(
    args.accountLabel
  )}`,
  metadata: toMetadata({
    provider: args.provider,
    accountLabel: args.accountLabel,
  }),
})

export const oauthDisconnectedEvent = (args: {
  provider: string
  accountLabel: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.OAUTH_DISCONNECTED,
  summary: `Disconnected ${providerLabel(args.provider)} account${withAccount(
    args.accountLabel
  )}`,
  metadata: toMetadata({
    provider: args.provider,
    accountLabel: args.accountLabel,
  }),
})

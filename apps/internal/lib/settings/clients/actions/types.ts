import type { AppUser } from '@/lib/auth/session'
import type { ClientActionResult } from '@/lib/settings/clients/client-service'

export type ClientMutationContext = {
  user: AppUser
}

export type ClientMutationResult = ClientActionResult & {
  didMutate: boolean
}

type MutationResultInput = ClientActionResult & {
  clientId?: string
  slug?: string
}

export function buildMutationResult(
  result: MutationResultInput
): ClientMutationResult {
  return {
    ...result,
    didMutate: !result.error,
  }
}

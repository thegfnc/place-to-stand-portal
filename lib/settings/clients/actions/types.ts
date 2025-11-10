import type { AppUser } from '@/lib/auth/session'
import type { ClientActionResult } from '@/lib/settings/clients/client-service'

export type ClientMutationContext = {
  user: AppUser
}

export type ClientMutationResult = ClientActionResult & {
  didMutate: boolean
}

export function buildMutationResult(
  result: ClientActionResult
): ClientMutationResult {
  return {
    ...result,
    didMutate: !result.error,
  }
}

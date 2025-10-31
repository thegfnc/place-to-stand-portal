import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppUser } from '@/lib/auth/session'
import type { Database } from '@/supabase/types/database'
import type { ClientActionResult } from '@/lib/settings/clients/client-service'

export type ClientMutationContext = {
  supabase: SupabaseClient<Database>
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

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/supabase/types/database'

export type ActionResult = {
  error?: string
}

export type SupabaseServerClient = SupabaseClient<Database>

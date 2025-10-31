import type { z } from 'zod'
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'

import type { Database } from '@/supabase/types/database'

import {
  hourBlockSchema,
  deleteSchema,
  restoreSchema,
  destroySchema,
} from './schemas'

export type SupabaseServerClient = SupabaseClient<Database>
export type SupabaseQueryError = PostgrestError | null

export type ActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type HourBlockInput = z.infer<typeof hourBlockSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type RestoreInput = z.infer<typeof restoreSchema>
export type DestroyInput = z.infer<typeof destroySchema>

export type ClientSummary = {
  id: string
  name: string
}

export type HourBlockWithClient = {
  id: string
  client_id: string
  hours_purchased: number
  invoice_number: string | null
  deleted_at: string | null
  client: { name: string | null } | null
}

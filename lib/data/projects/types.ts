import type { SupabaseClient } from '@supabase/supabase-js'

import type { DbProjectMember, DbTask, DbUser } from '@/lib/types'
import type { Database } from '@/supabase/types/database'

export type SupabaseServiceClient = SupabaseClient<Database>

export type MemberWithUser = DbProjectMember & { user: DbUser | null }

export type RawTaskRelation = {
  id: string
  deleted_at: string | null
}

export type RawTaskAttachment = {
  id: string
  task_id: string
  storage_path: string
  original_name: string
  mime_type: string
  file_size: number
  uploaded_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RawTaskWithRelations = DbTask & {
  assignees: Array<{ user_id: string; deleted_at: string | null }> | null
  comments: RawTaskRelation[] | null
  attachments: RawTaskAttachment[] | null
}

export type ClientMembership = {
  client_id: string | null
  deleted_at: string | null
}

export type RawHourBlock = {
  id: string
  client_id: string | null
  hours_purchased: number
  deleted_at: string | null
}

export type TimeLogSummary = {
  totalHours: number
  lastLogAt: string | null
}

export type ProjectBurndown = {
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  lastLogAt: string | null
}

import type { DbClientMember, DbTask, DbUser } from '@/lib/types'
export type MemberWithUser = DbClientMember & { user: DbUser | null }

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
  comment_count?: number | null
  attachment_count?: number | null
  attachments?: RawTaskAttachment[] | null
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
  monthToDateHours: number
  lastLogAt: string | null
}

export type ProjectBurndown = {
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  projectMonthToDateLoggedHours: number
  lastLogAt: string | null
}

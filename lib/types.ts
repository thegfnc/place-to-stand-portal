import type { Database } from '@/supabase/types/database'

export type DbClient = Database['public']['Tables']['clients']['Row']
export type DbClientMember =
  Database['public']['Tables']['client_members']['Row']
export type DbProject = Database['public']['Tables']['projects']['Row']
export type DbTask = Database['public']['Tables']['tasks']['Row']
export type DbUser = Database['public']['Tables']['users']['Row']
export type DbProjectMember =
  Database['public']['Tables']['project_members']['Row']
export type DbTaskComment = Database['public']['Tables']['task_comments']['Row']
export type DbTimeLog = Database['public']['Tables']['time_logs']['Row']
export type DbTimeLogTask =
  Database['public']['Tables']['time_log_tasks']['Row']

export type ProjectMemberWithUser = DbProjectMember & {
  user: DbUser
}

export type TaskWithRelations = DbTask & {
  assignees: { user_id: string }[]
  commentCount: number
}

export type TaskCommentWithAuthor = DbTaskComment & {
  author: DbUser | null
}

export type TimeLogWithUser = DbTimeLog & {
  user: DbUser | null
}

export type ProjectBurndownSummary = {
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  lastLogAt: string | null
}

export type ProjectWithRelations = DbProject & {
  client: DbClient | null
  members: ProjectMemberWithUser[]
  tasks: TaskWithRelations[]
  burndown: ProjectBurndownSummary
}

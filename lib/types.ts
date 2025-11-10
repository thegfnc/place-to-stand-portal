import type { Database } from '@/supabase/types/database'

export type DbClient = Database['public']['Tables']['clients']['Row']
export type DbClientMember =
  Database['public']['Tables']['client_members']['Row']
export type DbProject = Database['public']['Tables']['projects']['Row']
export type DbTask = Database['public']['Tables']['tasks']['Row']
export type DbUser = Database['public']['Tables']['users']['Row']
export type DbTaskComment = Database['public']['Tables']['task_comments']['Row']
export type DbTimeLog = Database['public']['Tables']['time_logs']['Row']
export type DbTimeLogTask =
  Database['public']['Tables']['time_log_tasks']['Row']
export type DbTaskAttachment =
  Database['public']['Tables']['task_attachments']['Row']

// ProjectMemberWithUser represents a client member who has access to a project
// The project_id is derived from the client_id for backwards compatibility
export type ProjectMemberWithUser = {
  id: number
  project_id: string
  user_id: string
  created_at: string
  deleted_at: string | null
  user: DbUser
}

export type TaskWithRelations = DbTask & {
  rank: string
  assignees: { user_id: string }[]
  commentCount: number
  attachments: DbTaskAttachment[]
}

export type TaskCommentAuthor = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type TaskCommentWithAuthor = DbTaskComment & {
  author: TaskCommentAuthor | null
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
  archivedTasks: TaskWithRelations[]
  burndown: ProjectBurndownSummary
}

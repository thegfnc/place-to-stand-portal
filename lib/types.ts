import { taskStatus, userRole } from '@/lib/db/schema'

export type UserRoleValue = (typeof userRole.enumValues)[number]
export type TaskStatusValue = (typeof taskStatus.enumValues)[number]

export type DbClient = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DbClientMember = {
  id: number
  client_id: string
  user_id: string
  created_at: string
  deleted_at: string | null
}

export type DbProject = {
  id: string
  client_id: string
  name: string
  status: string
  starts_on: string | null
  ends_on: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  slug: string | null
}

export type DbTask = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatusValue
  due_on: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  accepted_at: string | null
  rank: string
}

export type DbUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRoleValue
  avatar_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DbTaskComment = {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DbTimeLog = {
  id: string
  project_id: string
  user_id: string
  hours: number
  logged_on: string
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DbTimeLogTask = {
  id: string
  time_log_id: string
  task_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DbTaskAttachment = {
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
  attachmentCount: number
  attachments?: DbTaskAttachment[]
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
  acceptedTasks: TaskWithRelations[]
  burndown: ProjectBurndownSummary
}

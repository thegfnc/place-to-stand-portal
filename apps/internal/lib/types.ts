import {
  activitySource,
  clientBillingType,
  projectType,
  taskStatus,
  userRole,
  workerStatus,
} from '@/lib/db/schema'

export type UserRoleValue = (typeof userRole.enumValues)[number]
export type ActivitySourceValue = (typeof activitySource.enumValues)[number]
type TaskStatusValue = (typeof taskStatus.enumValues)[number]
export type ClientBillingTypeValue =
  (typeof clientBillingType.enumValues)[number]
export type ProjectTypeValue = (typeof projectType.enumValues)[number]
export type WorkerStatusValue = (typeof workerStatus.enumValues)[number]

export type DbClient = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  state: string | null
  origination_contact_id: string | null
  origination_user_id: string | null
  closer_user_id: string | null
  billing_type: ClientBillingTypeValue
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
  client_id: string | null
  name: string
  status: string
  type: ProjectTypeValue
  starts_on: string | null
  ends_on: string | null
  created_by: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  slug: string | null
}

export type DbTask = {
  id: string
  project_id: string
  lead_id: string | null
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
  completed_at: string | null
  rank: string
  github_issue_number: number | null
  github_issue_url: string | null
  worker_status: WorkerStatusValue | null
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
  // Optional: only populated where sign-in access matters (settings/users).
  // NULL/undefined means the user may sign in; set means auth rejects them.
  disabled_at?: string | null
}

type DbTaskComment = {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type DbTimeLog = {
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

export type DbTaskDeployment = {
  id: string
  task_id: string
  repo_link_id: string
  github_issue_number: number
  github_issue_url: string
  worker_status: WorkerStatusValue
  pr_url: string | null
  plan_id: string
  plan_thread_id: string | null
  plan_version: number | null
  model: string | null
  mode: string | null
  created_by: string
  created_at: string
  updated_at: string
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
  assignees: { user_id: string }[]
  commentCount: number
  attachmentCount: number
  /**
   * Sum of every time log linked to this task. A log split across N tasks
   * counts its full hours toward each, matching the total the task sheet
   * already shows — so card and sheet never disagree.
   */
  loggedHours: number
  attachments?: DbTaskAttachment[]
}
export type TaskCommentAuthor = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export type TaskCommentWithAuthor = DbTaskComment & {
  author: TaskCommentAuthor | null
}

export type TimeLogWithUser = DbTimeLog & {
  user: DbUser | null
}

type ProjectBurndownSummary = {
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  projectMonthToDateLoggedHours: number
  lastLogAt: string | null
}

import type { ProjectIntegrationLinkSummary } from '@/lib/types/integrations'

export type GitHubRepoLinkSummary = {
  id: string
  repoFullName: string
  defaultBranch: string
}

export type ProjectOwner = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProjectWithRelations = DbProject & {
  client: DbClient | null
  owner: ProjectOwner | null
  members: ProjectMemberWithUser[]
  tasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  burndown: ProjectBurndownSummary
  githubRepos: GitHubRepoLinkSummary[]
  integrationLinks: ProjectIntegrationLinkSummary[]
}

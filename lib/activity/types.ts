import type { Database, Json } from '@/supabase/types/database'

export type DbActivityLog = Database['public']['Tables']['activity_logs']['Row']

export type ActivityLogWithActor = DbActivityLog & {
  actor?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type ActivityTargetType =
  | 'TASK'
  | 'PROJECT'
  | 'CLIENT'
  | 'COMMENT'
  | 'TIME_LOG'
  | 'HOUR_BLOCK'
  | 'USER'
  | 'SETTINGS'
  | 'GENERAL'

export const ActivityVerbs = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_ARCHIVED: 'TASK_ARCHIVED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_ACCEPTANCE_REVERTED: 'TASK_ACCEPTANCE_REVERTED',
  TASKS_ACCEPTED: 'TASKS_ACCEPTED',
  TASK_RESTORED: 'TASK_RESTORED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_COMMENT_CREATED: 'TASK_COMMENT_CREATED',
  TASK_COMMENT_UPDATED: 'TASK_COMMENT_UPDATED',
  TASK_COMMENT_DELETED: 'TASK_COMMENT_DELETED',
  TIME_LOG_CREATED: 'TIME_LOG_CREATED',
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  CLIENT_ARCHIVED: 'CLIENT_ARCHIVED',
  CLIENT_RESTORED: 'CLIENT_RESTORED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  PROJECT_RESTORED: 'PROJECT_RESTORED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  HOUR_BLOCK_CREATED: 'HOUR_BLOCK_CREATED',
  HOUR_BLOCK_UPDATED: 'HOUR_BLOCK_UPDATED',
  HOUR_BLOCK_ARCHIVED: 'HOUR_BLOCK_ARCHIVED',
  HOUR_BLOCK_RESTORED: 'HOUR_BLOCK_RESTORED',
  HOUR_BLOCK_DELETED: 'HOUR_BLOCK_DELETED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_ARCHIVED: 'USER_ARCHIVED',
  USER_RESTORED: 'USER_RESTORED',
  USER_DELETED: 'USER_DELETED',
} as const

export type ActivityVerb = (typeof ActivityVerbs)[keyof typeof ActivityVerbs]

export type ActivityQueryFilters = {
  targetType?: ActivityTargetType | ActivityTargetType[]
  targetId?: string
  projectId?: string
  clientId?: string
  includeDeleted?: boolean
  cursor?: string
  limit?: number
}

export type ActivityQueryResult = {
  logs: ActivityLogWithActor[]
  hasMore: boolean
  nextCursor: string | null
}

export type ActivityEvent = {
  verb: ActivityVerb
  summary: string
  metadata?: Json
}

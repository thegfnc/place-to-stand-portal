import type { UserRole } from '@/lib/auth/session'
import type {
  DbUser,
  ProjectMemberWithUser,
  TaskWithRelations,
  TimeLogWithUser,
} from '@/lib/types'

export type ProjectTimeLogDialogParams = {
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  clientRemainingHours: number | null
  tasks: TaskWithRelations[]
  currentUserId: string
  currentUserRole: UserRole
  projectMembers: ProjectMemberWithUser[]
  admins: DbUser[]
}

export type TimeLogFormField = 'hours' | 'loggedOn' | 'user' | 'general'

export type TimeLogFormErrors = Partial<Record<TimeLogFormField, string>>

export type FieldError = Error & { field?: TimeLogFormField }

export const TIME_LOGS_QUERY_KEY = 'project-time-logs' as const

export type ProjectTimeLogHistoryDialogParams = {
  projectId: string
  projectName: string
  clientName: string | null
  currentUserId: string
  currentUserRole: UserRole
}

export type TimeLogEntry = TimeLogWithUser & {
  linked_tasks: Array<{
    id: string
    deleted_at: string | null
    task: {
      id: string
      title: string | null
      status: string | null
      deleted_at: string | null
    } | null
  }> | null
}

import type { DbUser, ProjectWithRelations } from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

export type BoardInitializationProps = {
  projects: ProjectWithRelations[]
  currentUserId: string
  currentUserRole: UserRole
  activeClientId: string | null
  activeProjectId: string | null
}

export type BoardLookups = {
  projectLookup: Map<string, ProjectWithRelations>
  projectsByClientId: Map<string, ProjectWithRelations[]>
}

export type BoardContext = {
  selectedClientId: string | null
  selectedProjectId: string | null
  feedback: string | null
  isPending: boolean
  tasksByProject: Map<
    string,
    ReturnType<ProjectWithRelations['tasks']['slice']>
  >
  admins: DbUser[]
}

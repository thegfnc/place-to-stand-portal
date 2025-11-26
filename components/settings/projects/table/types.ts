import type { PageInfo } from '@/lib/pagination/cursor'
import type {
  ClientRow,
  ProjectWithClient as SheetProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'

export type ProjectWithClient = SheetProjectWithClient

export type ContractorUserSummary = {
  id: string
  email: string
  fullName: string | null
}

export type ProjectsSettingsTableProps = {
  projects: ProjectWithClient[]
  clients: ClientRow[]
  contractorUsers: ContractorUserSummary[]
  membersByProject: Record<string, ContractorUserSummary[]>
  tab: ProjectsTab
  pageInfo: PageInfo
  totalCount: number
}

export type ProjectsTableMode = 'active' | 'archive'

export type ProjectsTab = 'projects' | 'archive' | 'activity'

import type { Database } from '@/supabase/types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']

type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

export type ProjectWithClient = ProjectRow & { client: ClientRow | null }

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
}

export type ProjectsTableMode = 'active' | 'archive'

export type ProjectsTab = 'projects' | 'archive' | 'activity'

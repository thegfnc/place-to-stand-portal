import type {
  ContractorUserSummary,
  ProjectWithClient,
} from './project-sheet-form'

export type ContractorButtonState = {
  disabled: boolean
  reason: string | null
}

export const PROJECT_SHEET_PENDING_REASON =
  'Please wait for the current request to finish.'

export const getContractorDisplayName = (user: ContractorUserSummary) =>
  user.fullName?.trim() || user.email

export const getInitialContractors = (
  project: ProjectWithClient | null,
  projectContractors: Record<string, ContractorUserSummary[]>
): ContractorUserSummary[] => {
  if (!project) return []
  return (projectContractors[project.id] ?? []).map(member => ({ ...member }))
}

export const buildAvailableContractors = (
  directory: ContractorUserSummary[],
  selected: ContractorUserSummary[]
): ContractorUserSummary[] =>
  directory.filter(user => !selected.some(assigned => assigned.id === user.id))

export const isContractorSelectionDirty = (
  savedIds: string[],
  selected: ContractorUserSummary[]
): boolean => {
  const currentIds = selected.map(member => member.id).sort()

  if (savedIds.length !== currentIds.length) {
    return true
  }

  return savedIds.some((id, index) => id !== currentIds[index])
}

export const deriveContractorButtonState = (
  isPending: boolean,
  available: ContractorUserSummary[]
): ContractorButtonState => {
  const disabled = isPending || available.length === 0
  const reason = disabled
    ? isPending
      ? PROJECT_SHEET_PENDING_REASON
      : 'All contractor-role users are already assigned.'
    : null

  return { disabled, reason }
}

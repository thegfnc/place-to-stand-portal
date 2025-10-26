import { useCallback, useMemo, useState } from 'react'

import {
  buildAvailableContractors,
  deriveContractorButtonState,
  getContractorDisplayName,
  getInitialContractors,
  isContractorSelectionDirty,
  type ContractorButtonState,
} from './project-sheet-contractors'
import type {
  ContractorUserSummary,
  ProjectWithClient,
} from './project-sheet-form'

export type UseProjectContractorSelectionArgs = {
  project: ProjectWithClient | null
  projectContractors: Record<string, ContractorUserSummary[]>
  contractorDirectory: ContractorUserSummary[]
  isPending: boolean
}

export type UseProjectContractorSelectionReturn = {
  selectedContractors: ContractorUserSummary[]
  availableContractors: ContractorUserSummary[]
  contractorButton: ContractorButtonState
  isContractorPickerOpen: boolean
  contractorRemovalCandidate: ContractorUserSummary | null
  contractorRemovalName: string | null
  contractorProjectName: string
  contractorSelectionDirty: boolean
  handleAddContractor: (user: ContractorUserSummary) => void
  handleContractorPickerOpenChange: (open: boolean) => void
  handleRequestContractorRemoval: (user: ContractorUserSummary) => void
  handleCancelContractorRemoval: () => void
  handleConfirmContractorRemoval: () => void
  resetSelection: () => void
  markSelectionSaved: () => void
  replaceContractors: (contractors: ContractorUserSummary[]) => void
}

export function useProjectContractorSelection(
  args: UseProjectContractorSelectionArgs
): UseProjectContractorSelectionReturn {
  const { project, projectContractors, contractorDirectory, isPending } = args

  const initialContractors = useMemo(
    () => getInitialContractors(project, projectContractors),
    [project, projectContractors]
  )

  const [savedContractorIds, setSavedContractorIds] = useState<string[]>(() =>
    initialContractors.map(member => member.id).sort()
  )
  const [selectedContractors, setSelectedContractors] =
    useState<ContractorUserSummary[]>(initialContractors)
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false)
  const [contractorRemovalCandidate, setContractorRemovalCandidate] =
    useState<ContractorUserSummary | null>(null)

  const contractorProjectName = project?.name ?? 'this project'

  const availableContractors = useMemo(
    () => buildAvailableContractors(contractorDirectory, selectedContractors),
    [contractorDirectory, selectedContractors]
  )

  const contractorButton = useMemo(
    () => deriveContractorButtonState(isPending, availableContractors),
    [availableContractors, isPending]
  )

  const contractorRemovalName = useMemo(() => {
    if (!contractorRemovalCandidate) {
      return null
    }

    return getContractorDisplayName(contractorRemovalCandidate)
  }, [contractorRemovalCandidate])

  const contractorSelectionDirty = useMemo(
    () => isContractorSelectionDirty(savedContractorIds, selectedContractors),
    [savedContractorIds, selectedContractors]
  )

  const handleAddContractor = useCallback((user: ContractorUserSummary) => {
    setSelectedContractors(prev => {
      if (prev.some(contractor => contractor.id === user.id)) {
        return prev
      }

      return [...prev, user]
    })
    setIsContractorPickerOpen(false)
  }, [])

  const handleRequestContractorRemoval = useCallback(
    (user: ContractorUserSummary) => {
      setContractorRemovalCandidate(user)
    },
    []
  )

  const handleCancelContractorRemoval = useCallback(() => {
    setContractorRemovalCandidate(null)
  }, [])

  const handleConfirmContractorRemoval = useCallback(() => {
    if (!contractorRemovalCandidate) {
      return
    }

    setSelectedContractors(prev =>
      prev.filter(contractor => contractor.id !== contractorRemovalCandidate.id)
    )
    setContractorRemovalCandidate(null)
  }, [contractorRemovalCandidate])

  const handleContractorPickerOpenChange = useCallback(
    (next: boolean) => {
      if (contractorButton.disabled) {
        setIsContractorPickerOpen(false)
        return
      }

      setIsContractorPickerOpen(next)
    },
    [contractorButton.disabled]
  )

  const resetSelection = useCallback(() => {
    setSelectedContractors(initialContractors)
    setSavedContractorIds(initialContractors.map(member => member.id).sort())
    setContractorRemovalCandidate(null)
    setIsContractorPickerOpen(false)
  }, [initialContractors])

  const markSelectionSaved = useCallback(() => {
    setSavedContractorIds(
      selectedContractors.map(contractor => contractor.id).sort()
    )
  }, [selectedContractors])

  const replaceContractors = useCallback(
    (contractors: ContractorUserSummary[]) => {
      setSelectedContractors(contractors.map(contractor => ({ ...contractor })))
      setContractorRemovalCandidate(null)
      setIsContractorPickerOpen(false)
    },
    []
  )

  return {
    selectedContractors,
    availableContractors,
    contractorButton,
    isContractorPickerOpen,
    contractorRemovalCandidate,
    contractorRemovalName,
    contractorProjectName,
    contractorSelectionDirty,
    handleAddContractor,
    handleContractorPickerOpenChange,
    handleRequestContractorRemoval,
    handleCancelContractorRemoval,
    handleConfirmContractorRemoval,
    resetSelection,
    markSelectionSaved,
    replaceContractors,
  }
}

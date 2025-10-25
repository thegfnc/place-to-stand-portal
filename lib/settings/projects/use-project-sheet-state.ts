'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveProject,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  buildProjectFormDefaults,
  createProjectSavePayload,
  projectSheetFormSchema,
  PROJECT_FORM_FIELDS,
  sortClientsByName,
  type ClientRow,
  type ContractorUserSummary,
  type ProjectSheetFormValues,
  type ProjectWithClient,
} from './project-sheet-form'
import {
  buildAvailableContractors,
  deriveContractorButtonState,
  getContractorDisplayName,
  getInitialContractors,
  isContractorSelectionDirty,
  type ContractorButtonState,
} from './project-sheet-contractors'
import {
  buildClientOptions,
  deriveDeleteButtonState,
  deriveSubmitButtonState,
  type ClientOption,
  type DeleteButtonState,
  type SubmitButtonState,
} from './project-sheet-ui-state'

export type {
  ContractorUserSummary,
  ProjectSheetFormValues,
  ProjectWithClient,
} from './project-sheet-form'
export { PROJECT_SHEET_PENDING_REASON } from './project-sheet-contractors'
export { PROJECT_SHEET_MISSING_CLIENT_REASON } from './project-sheet-ui-state'

export type UseProjectSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory: ContractorUserSummary[]
  projectContractors: Record<string, ContractorUserSummary[]>
}

export type UseProjectSheetStateReturn = {
  form: UseFormReturn<ProjectSheetFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  contractorButton: ContractorButtonState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  availableContractors: ContractorUserSummary[]
  selectedContractors: ContractorUserSummary[]
  contractorRemovalCandidate: ContractorUserSummary | null
  contractorRemovalName: string | null
  contractorProjectName: string
  isContractorPickerOpen: boolean
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: ProjectSheetFormValues) => void
  handleAddContractor: (user: ContractorUserSummary) => void
  handleContractorPickerOpenChange: (open: boolean) => void
  handleRequestContractorRemoval: (user: ContractorUserSummary) => void
  handleCancelContractorRemoval: () => void
  handleConfirmContractorRemoval: () => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export function useProjectSheetState({
  open,
  onOpenChange,
  onComplete,
  project,
  clients,
  contractorDirectory,
  projectContractors,
}: UseProjectSheetStateArgs): UseProjectSheetStateReturn {
  const isEditing = Boolean(project)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false)
  const [contractorRemovalCandidate, setContractorRemovalCandidate] =
    useState<ContractorUserSummary | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const initialContractors = useMemo(
    () => getInitialContractors(project, projectContractors),
    [project, projectContractors]
  )
  const [savedContractorIds, setSavedContractorIds] = useState<string[]>(() =>
    initialContractors.map(member => member.id).sort()
  )
  const [selectedContractors, setSelectedContractors] = useState<
    ContractorUserSummary[]
  >(initialContractors)
  const { toast } = useToast()

  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const clientOptions = useMemo<ClientOption[]>(
    () => buildClientOptions(sortedClients),
    [sortedClients]
  )

  const resolver = zodResolver(
    projectSheetFormSchema
  ) as Resolver<ProjectSheetFormValues>

  const form = useForm<ProjectSheetFormValues>({
    resolver,
    defaultValues: buildProjectFormDefaults(project),
  })

  const contractorSelectionDirty = useMemo(
    () => isContractorSelectionDirty(savedContractorIds, selectedContractors),
    [savedContractorIds, selectedContractors]
  )

  const hasUnsavedChanges = form.formState.isDirty || contractorSelectionDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const availableContractors = useMemo(
    () => buildAvailableContractors(contractorDirectory, selectedContractors),
    [contractorDirectory, selectedContractors]
  )

  const contractorButton = useMemo(
    () => deriveContractorButtonState(isPending, availableContractors),
    [availableContractors, isPending]
  )

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(project)
    const contractorSnapshot = getInitialContractors(
      project,
      projectContractors
    )

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setSavedContractorIds(contractorSnapshot.map(member => member.id).sort())
    setFeedback(null)
    setSelectedContractors(contractorSnapshot)
    setContractorRemovalCandidate(null)
    setIsContractorPickerOpen(false)
  }, [form, project, projectContractors])

  const applyServerFieldErrors = useCallback(
    (fieldErrors?: Record<string, string[]>) => {
      if (!fieldErrors) return

      PROJECT_FORM_FIELDS.forEach(field => {
        const message = fieldErrors[field]?.[0]
        if (!message) return
        form.setError(field, { type: 'server', message })
      })
    },
    [form]
  )

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState()
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
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

  const handleConfirmContractorRemoval = useCallback(() => {
    if (!contractorRemovalCandidate) {
      return
    }

    const removalId = contractorRemovalCandidate.id
    setSelectedContractors(prev =>
      prev.filter(contractor => contractor.id !== removalId)
    )
    setContractorRemovalCandidate(null)
  }, [contractorRemovalCandidate])

  const handleCancelContractorRemoval = useCallback(() => {
    setContractorRemovalCandidate(null)
  }, [])

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

  const handleSubmit = useCallback(
    (values: ProjectSheetFormValues) => {
      startTransition(async () => {
        setFeedback(null)
        form.clearErrors()

        if (isEditing && !values.slug?.trim()) {
          form.setError('slug', { type: 'manual', message: 'Slug is required' })
          return
        }

        const payload = createProjectSavePayload({
          values,
          project,
          selectedContractors,
          isEditing,
        })

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const result = await saveProject(payload)

        applyServerFieldErrors(result.fieldErrors)

        if (result.error) {
          setFeedback(result.error)
          toast({
            title: 'Unable to save project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: isEditing ? 'Project updated' : 'Project created',
          description: isEditing
            ? 'Changes saved successfully.'
            : 'The project is ready to track activity.',
        })

        setSavedContractorIds(
          selectedContractors.map(contractor => contractor.id).sort()
        )
        form.reset({
          name: payload.name,
          clientId: payload.clientId,
          status: payload.status,
          startsOn: payload.startsOn ?? '',
          endsOn: payload.endsOn ?? '',
          slug: payload.slug ?? '',
        })

        onOpenChange(false)
        onComplete()
      })
    },
    [
      applyServerFieldErrors,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      project,
      selectedContractors,
      startTransition,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [isPending, project])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()
      const result = await softDeleteProject({ id: project.id })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to delete project',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Project deleted',
        description: 'You can still find it in historical reporting.',
      })

      onOpenChange(false)
      onComplete()
    })
  }, [
    form,
    isPending,
    onComplete,
    onOpenChange,
    project,
    startTransition,
    toast,
  ])

  const submitButton = useMemo(
    () => deriveSubmitButtonState(isPending, isEditing, clientOptions),
    [clientOptions, isEditing, isPending]
  )

  const deleteButton = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, project),
    [isEditing, isPending, project]
  )

  const contractorRemovalName = useMemo(() => {
    if (!contractorRemovalCandidate) {
      return null
    }

    return getContractorDisplayName(contractorRemovalCandidate)
  }, [contractorRemovalCandidate])

  const contractorProjectName = project?.name ?? 'this project'

  return {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    contractorButton,
    submitButton,
    deleteButton,
    availableContractors,
    selectedContractors,
    contractorRemovalCandidate,
    contractorRemovalName,
    contractorProjectName,
    isContractorPickerOpen,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleAddContractor,
    handleContractorPickerOpenChange,
    handleRequestContractorRemoval,
    handleCancelContractorRemoval,
    handleConfirmContractorRemoval,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}

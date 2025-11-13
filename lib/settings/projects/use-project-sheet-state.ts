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
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
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
export { PROJECT_SHEET_MISSING_CLIENT_REASON } from './project-sheet-ui-state'

export type UseProjectSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

export type UseProjectSheetStateReturn = {
  form: UseFormReturn<ProjectSheetFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: ProjectSheetFormValues) => void
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
}: UseProjectSheetStateArgs): UseProjectSheetStateReturn {
  const isEditing = Boolean(project)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
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

  const hasUnsavedChanges = form.formState.isDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(project)

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setFeedback(null)
  }, [form, project])

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
          isEditing,
        })

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'project',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            clientId: payload.clientId,
            status: payload.status,
          },
        })

        try {
          const result = await saveProject(payload)

          applyServerFieldErrors(result.fieldErrors)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            toast({
              title: 'Unable to save project',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? null,
          })

          toast({
            title: isEditing ? 'Project updated' : 'Project created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The project is ready to track activity.',
          })

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
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save the project. Please try again.')
          toast({
            title: 'Unable to save project',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        }
      })
    },
    [
      applyServerFieldErrors,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      project,
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
      const interaction = startSettingsInteraction({
        entity: 'project',
        mode: 'delete',
        targetId: project.id,
        metadata: {
          clientId: project.client_id ?? null,
        },
      })

      try {
        const result = await softDeleteProject({ id: project.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: project.id,
            error: result.error,
          })
          setFeedback(result.error)
          toast({
            title: 'Unable to delete project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: project.id,
        })

        toast({
          title: 'Project deleted',
          description: 'You can still find it in historical reporting.',
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: project.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not delete this project. Please try again.')
        toast({
          title: 'Unable to delete project',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
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

  return {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}

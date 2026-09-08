'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'

import type { IntegrationProvider } from '@/lib/types/integrations'

import {
  saveProject,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
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


export type UseProjectSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

type PendingRepo = {
  repoFullName: string
  source?: 'oauth' | 'app'
  sourceId?: string
}

export type PendingIntegrationLink = {
  provider: IntegrationProvider
  externalId: string
  externalName: string
  ownerName: string | null
}

/**
 * Link edits the sheet accumulates and applies after the project row saves.
 * Only ids are needed to unlink; pending entries carry what the POST needs.
 */
export type ProjectSheetLinkChanges = {
  pendingRepos: PendingRepo[]
  removedRepoIds: string[]
  pendingIntegrationLinks: PendingIntegrationLink[]
  removedIntegrationLinkIds: string[]
}

export type UseProjectSheetStateReturn = {
  form: UseFormReturn<ProjectSheetFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  projectType: ProjectSheetFormValues['projectType']
  requiresClientSelection: boolean
  clientOptions: ClientOption[]
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (
    values: ProjectSheetFormValues,
    changes: ProjectSheetLinkChanges
  ) => void
  handleReposDirtyChange: (isDirty: boolean) => void
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReposDirty, setIsReposDirty] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

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

  const hasUnsavedChanges = form.formState.isDirty || isReposDirty
  const projectType =
    useWatch({
      control: form.control,
      name: 'projectType',
    }) ?? 'CLIENT'
  const requiresClientSelection = projectType === 'CLIENT'

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(project)

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setFeedback(null)
    setIsReposDirty(false)
  }, [form, project])

  const handleReposDirtyChange = useCallback((isDirty: boolean) => {
    setIsReposDirty(isDirty)
  }, [])

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

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: hasUnsavedChanges,
    onReset: resetFormState,
    resetKey: project?.id ?? null,
  })

  const linkPendingRepos = useCallback(
    async (projectId: string, pendingRepos: PendingRepo[]) => {
      if (pendingRepos.length === 0) return

      const linkPromises = pendingRepos.map(repo =>
        fetch(`/api/projects/${projectId}/github-repos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoFullName: repo.repoFullName,
            ...(repo.source === 'app'
              ? { githubAppInstallationId: repo.sourceId }
              : repo.source === 'oauth'
                ? { connectionId: repo.sourceId }
                : {}),
          }),
        })
      )

      try {
        await Promise.all(linkPromises)
      } catch {
        // Log but don't fail the save - repos can be linked manually later
        console.error('Failed to link some repositories')
      }
    },
    []
  )

  const unlinkRemovedRepos = useCallback(
    async (projectId: string, removedRepoIds: string[]) => {
      if (removedRepoIds.length === 0) return

      const unlinkPromises = removedRepoIds.map(repoId =>
        fetch(`/api/projects/${projectId}/github-repos/${repoId}`, {
          method: 'DELETE',
        })
      )

      try {
        await Promise.all(unlinkPromises)
      } catch {
        // Log but don't fail the save - repos can be unlinked manually later
        console.error('Failed to unlink some repositories')
      }
    },
    []
  )

  const linkPendingIntegrations = useCallback(
    async (projectId: string, pending: PendingIntegrationLink[]) => {
      if (pending.length === 0) return

      const results = await Promise.allSettled(
        pending.map(link =>
          fetch(`/api/projects/${projectId}/integration-links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: link.provider,
              externalId: link.externalId,
            }),
          }).then(res => {
            if (!res.ok) throw new Error(`${link.externalName}: ${res.status}`)
          })
        )
      )

      const failed = results.filter(result => result.status === 'rejected')
      if (failed.length > 0) {
        console.error('Failed to link some hosting projects', failed)
        toast({
          title: 'Some hosting links were not saved',
          description: 'Open the project again to retry linking them.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const unlinkRemovedIntegrations = useCallback(
    async (projectId: string, removedIds: string[]) => {
      if (removedIds.length === 0) return

      const results = await Promise.allSettled(
        removedIds.map(linkId =>
          fetch(`/api/projects/${projectId}/integration-links/${linkId}`, {
            method: 'DELETE',
          }).then(res => {
            if (!res.ok) throw new Error(`${linkId}: ${res.status}`)
          })
        )
      )

      if (results.some(result => result.status === 'rejected')) {
        console.error('Failed to unlink some hosting projects')
        toast({
          title: 'Some hosting links were not removed',
          description: 'Open the project again to retry removing them.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const handleSubmit = useCallback(
    (values: ProjectSheetFormValues, changes: ProjectSheetLinkChanges) => {
      const {
        pendingRepos,
        removedRepoIds,
        pendingIntegrationLinks,
        removedIntegrationLinkIds,
      } = changes
      startSave(async () => {
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

          // Link pending repos and unlink removed repos after successful save
          const targetProjectId = result.projectId ?? payload.id
          if (targetProjectId) {
            await Promise.all([
              pendingRepos.length > 0
                ? linkPendingRepos(targetProjectId, pendingRepos)
                : Promise.resolve(),
              removedRepoIds.length > 0
                ? unlinkRemovedRepos(targetProjectId, removedRepoIds)
                : Promise.resolve(),
              linkPendingIntegrations(targetProjectId, pendingIntegrationLinks),
              unlinkRemovedIntegrations(
                targetProjectId,
                removedIntegrationLinkIds
              ),
            ])
            // The sheet stays mounted between opens, so the links section's
            // query never remounts — invalidate it or the next open shows
            // the pre-save list.
            await queryClient.invalidateQueries({
              queryKey: ['projectIntegrationLinks', targetProjectId],
            })
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: targetProjectId ?? null,
          })

          toast({
            title: isEditing ? 'Project updated' : 'Project created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The project is ready to track activity.',
          })

          form.reset({
            name: payload.name,
            projectType: payload.projectType,
            clientId: payload.clientId ?? '',
            status: payload.status,
            startsOn: payload.startsOn ?? '',
            endsOn: payload.endsOn ?? '',
            slug: payload.slug ?? '',
            ownerId: payload.ownerId ?? '',
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
      linkPendingRepos,
      linkPendingIntegrations,
      unlinkRemovedIntegrations,
      queryClient,
      unlinkRemovedRepos,
      onComplete,
      onOpenChange,
      project,
      startSave,
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
    startSave(async () => {
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
            title: 'Unable to archive project',
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
          title: 'Project archived',
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
        setFeedback('We could not archive this project. Please try again.')
        toast({
          title: 'Unable to archive project',
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
    startSave,
    toast,
  ])

  const submitButton = useMemo(
    () =>
      deriveSubmitButtonState(
        isPending,
        isEditing,
        clientOptions,
        requiresClientSelection
      ),
    [clientOptions, isEditing, isPending, requiresClientSelection]
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
    projectType,
    requiresClientSelection,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleReposDirtyChange,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}

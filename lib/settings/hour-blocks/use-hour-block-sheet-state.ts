'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveHourBlock,
  softDeleteHourBlock,
} from '@/app/(dashboard)/settings/hour-blocks/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import {
  buildHourBlockFormDefaults,
  createHourBlockSavePayload,
  hourBlockFormSchema,
  HOUR_BLOCK_FORM_FIELDS,
  sortClientsByName,
  type ClientRow,
  type HourBlockFormValues,
  type HourBlockWithClient,
} from './hour-block-form'
export type { HourBlockFormValues } from './hour-block-form'
import { buildClientOptions, type ClientOption } from './hour-block-options'
import {
  deriveClientFieldState,
  deriveDeleteButtonState,
  deriveStandardFieldState,
  deriveSubmitButtonState,
  type DeleteButtonState,
  type FieldState,
  type SubmitButtonState,
} from './hour-block-ui-state'

export type UseHourBlockSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  clients: ClientRow[]
}

export type UseHourBlockSheetStateReturn = {
  form: UseFormReturn<HourBlockFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  clientField: FieldState
  hoursField: FieldState
  invoiceField: FieldState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: HourBlockFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  setFeedback: (value: string | null) => void
}

export function useHourBlockSheetState({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
}: UseHourBlockSheetStateArgs): UseHourBlockSheetStateReturn {
  const isEditing = Boolean(hourBlock)
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
    hourBlockFormSchema
  ) as Resolver<HourBlockFormValues>

  const form = useForm<HourBlockFormValues>({
    resolver,
    defaultValues: buildHourBlockFormDefaults(hourBlock),
  })

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset(buildHourBlockFormDefaults(hourBlock))
    form.clearErrors()
    setFeedback(null)
  }, [form, hourBlock])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const applyServerFieldErrors = useCallback(
    (fieldErrors?: Record<string, string[]>) => {
      if (!fieldErrors) return

      HOUR_BLOCK_FORM_FIELDS.forEach(field => {
        const message = fieldErrors[field]?.[0]
        if (!message) return
        form.setError(field, { type: 'server', message })
      })
    },
    [form]
  )

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
    (values: HourBlockFormValues) => {
      startTransition(async () => {
        setFeedback(null)
        form.clearErrors()

        const payload = createHourBlockSavePayload(values, hourBlock)

        const interaction = startSettingsInteraction({
          entity: 'hour_block',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            clientId: payload.clientId ?? null,
          },
        })

        try {
          const result = await saveHourBlock(payload)

          applyServerFieldErrors(result.fieldErrors)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            toast({
              title: 'Unable to save hour block',
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
            title: isEditing ? 'Hour block updated' : 'Hour block created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The hour block is ready for tracking.',
          })

          resetFormState()
          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save this hour block. Please try again.')
          toast({
            title: 'Unable to save hour block',
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
      hourBlock,
      isEditing,
      onComplete,
      onOpenChange,
      resetFormState,
      startTransition,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [hourBlock, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()
      const interaction = startSettingsInteraction({
        entity: 'hour_block',
        mode: 'delete',
        targetId: hourBlock.id,
        metadata: {
          clientId: hourBlock.client?.id ?? null,
        },
      })

      try {
        const result = await softDeleteHourBlock({ id: hourBlock.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: hourBlock.id,
            error: result.error,
          })
          setFeedback(result.error)
          toast({
            title: 'Unable to delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: hourBlock.id,
        })

        toast({
          title: 'Hour block archived',
          description:
            'It will be hidden from active tracking but remains available historically.',
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: hourBlock.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not delete this hour block. Please try again.')
        toast({
          title: 'Unable to delete hour block',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
    })
  }, [
    form,
    hourBlock,
    isPending,
    onComplete,
    onOpenChange,
    startTransition,
    toast,
  ])

  const clientField: FieldState = useMemo(
    () => deriveClientFieldState(isPending, clientOptions),
    [clientOptions, isPending]
  )

  const hoursField: FieldState = useMemo(
    () => deriveStandardFieldState(isPending),
    [isPending]
  )

  const invoiceField = hoursField

  const submitButton: SubmitButtonState = useMemo(
    () => deriveSubmitButtonState(isPending, isEditing, clientOptions),
    [clientOptions, isEditing, isPending]
  )

  const deleteButton: DeleteButtonState = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, hourBlock),
    [hourBlock, isEditing, isPending]
  )

  return {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    clientField,
    hoursField,
    invoiceField,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    setFeedback,
  }
}

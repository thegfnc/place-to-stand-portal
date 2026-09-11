'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'

import { useToast } from '@/components/ui/use-toast'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { archiveLead, saveLead } from '@/app/(dashboard)/leads/actions'
import { getSubmitLabel } from '@/lib/forms/form-controls'
import {
  leadFormSchema,
  type LeadFormValues,
  type LeadSheetProps,
} from '@/app/(dashboard)/leads/_components/lead-sheet/types'

export function useLeadSheetState({
  open,
  onOpenChange,
  lead,
  initialStatus,
  initialAction = null,
  onSuccess,
  onCreated,
  initialValues,
}: Omit<LeadSheetProps, 'assignees' | 'canManage'>) {
  const isEditing = Boolean(lead)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const hasInitialAction = Boolean(lead && initialAction)
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [isConvertDialogOpen, setConvertDialogOpen] = useState(
    () => hasInitialAction && initialAction === 'convert'
  )
  const { toast } = useToast()

  const { setAux } = useSheetParams()

  // Mirrors the convert dialog's open state into `?leadMode=convert` so the
  // sub-state is shareable, via the router (replace) rather than raw history
  // mutation — the Next router cache stays in sync with the URL.
  const setActionParam = useCallback(
    (action: string | null) => {
      if (!lead) return
      setAux('leadMode', action)
    },
    [lead, setAux]
  )

  const canConvert = lead?.status === 'CLOSED_WON' && !lead?.convertedToClientId

  const defaultValues = useMemo<LeadFormValues>(
    () => ({
      contactName: lead?.contactName ?? initialValues?.contactName ?? '',
      contactEmail: lead?.contactEmail ?? initialValues?.contactEmail ?? '',
      contactPhone: lead?.contactPhone ?? '',
      companyName: lead?.companyName ?? initialValues?.companyName ?? '',
      companyWebsite: lead?.companyWebsite ?? '',
      sourceType: lead?.sourceType ?? null,
      sourceDetail: lead?.sourceDetail ?? '',
      status: lead?.status ?? initialStatus ?? 'NEW_OPPORTUNITIES',
      assigneeId: lead?.assigneeId ?? null,
      notes: lead?.notesHtml ?? initialValues?.notes ?? '',
    }),
    [lead, initialStatus, initialValues]
  )

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const selectedSourceType = useWatch({
    control: form.control,
    name: 'sourceType',
  })

  useEffect(() => {
    if (!selectedSourceType) {
      const currentDetail = form.getValues('sourceDetail')
      if (currentDetail) {
        form.setValue('sourceDetail', '')
      }
    }
  }, [form, selectedSourceType])

  const submitDisabled = isSaving || isArchiving
  const historyKey = lead?.id ?? 'lead:new'

  const handleFormSubmit = useCallback(
    (values: LeadFormValues) => {
      startSaveTransition(async () => {
        const result = await saveLead({
          id: lead?.id,
          ...values,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to save lead',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        toast({
          title: isEditing ? 'Lead updated' : 'Lead created',
          description: isEditing
            ? 'The lead has been updated successfully.'
            : 'Your new lead has been added to the pipeline.',
        })

        form.reset({
          ...values,
          contactName: values.contactName ?? '',
          contactEmail: values.contactEmail ?? '',
          contactPhone: values.contactPhone ?? '',
          companyName: values.companyName ?? '',
          companyWebsite: values.companyWebsite ?? '',
          sourceType: values.sourceType ?? null,
          sourceDetail: values.sourceDetail ?? '',
          status: values.status,
          assigneeId: values.assigneeId ?? null,
          notes: values.notes ?? '',
        })

        setArchiveDialogOpen(false)
        onOpenChange(false)
        onSuccess()
        if (!isEditing && result.leadId) {
          onCreated?.(result.leadId)
        }
      })
    },
    [form, isEditing, lead?.id, onOpenChange, onSuccess, onCreated, toast]
  )

  const handleSaveShortcut = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls<LeadFormValues>(
    {
      form,
      isActive: open,
      canSave: !submitDisabled,
      onSave: handleSaveShortcut,
      historyKey,
    }
  )

  const saveLabel = useMemo(
    () => getSubmitLabel({ isSaving, isEditing, createLabel: 'Create lead' }),
    [isEditing, isSaving]
  )

  const submitDisabledReason = isSaving
    ? 'Saving lead...'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const archiveDisabledReason = isSaving
    ? 'Finish saving before archiving.'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const handleArchive = useCallback(() => {
    if (!lead) return

    startArchiveTransition(async () => {
      const result = await archiveLead({ leadId: lead.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive lead',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Lead archived',
        description: 'The lead has been archived and removed from the board.',
      })

      setArchiveDialogOpen(false)
      onOpenChange(false)
      onSuccess()
    })
  }, [lead, onOpenChange, onSuccess, toast])

  const {
    requestConfirmation: requestCloseConfirmation,
    dialog: unsavedChangesDialog,
  } = useUnsavedChangesWarning({
    isDirty: form.formState.isDirty,
    title: 'Discard lead changes?',
    description:
      'You have unsaved updates for this lead. Continue without saving?',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  })

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true)
        return
      }

      requestCloseConfirmation(() => {
        setArchiveDialogOpen(false)
        onOpenChange(false)
      })
    },
    [onOpenChange, requestCloseConfirmation]
  )

  return {
    form,
    isEditing,
    isSaving,
    isArchiving,
    isArchiveDialogOpen,
    setArchiveDialogOpen,
    isConvertDialogOpen,
    setConvertDialogOpen,
    setActionParam,
    canConvert,
    selectedSourceType,
    submitDisabled,
    submitDisabledReason,
    archiveDisabledReason,
    saveLabel,
    undo,
    redo,
    canUndo,
    canRedo,
    unsavedChangesDialog,
    handleFormSubmit,
    handleArchive,
    handleSheetOpenChange,
  }
}

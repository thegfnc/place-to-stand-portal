'use client'

import { useState, useTransition } from 'react'

import { useToast } from '@/components/ui/use-toast'

import { PENDING_REASON } from '../client-sheet-constants'

import { useClientDeletionState } from './delete-state'
import { useClientSheetFormState } from './form-state'
import type {
  UseClientSheetStateArgs,
  UseClientSheetStateReturn,
} from './types'

export const useClientSheetState = ({
  open,
  onOpenChange,
  onComplete,
  onArchived,
  client,
  allClientUsers,
  clientMembers,
}: UseClientSheetStateArgs): UseClientSheetStateReturn => {
  const isEditing = Boolean(client)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const formState = useClientSheetFormState({
    open,
    onOpenChange,
    onComplete,
    client,
    clientMembers,
    allClientUsers,
    isEditing,
    isPending,
    startTransition,
    setFeedback,
    toast,
  })

  const deletionState = useClientDeletionState({
    client,
    isPending,
    startTransition,
    setFeedback,
    onOpenChange,
    onComplete,
    onArchived,
    toast,
  })

  const clientDisplayName = client?.name ?? 'this client'

  return {
    form: formState.form,
    isEditing,
    feedback,
    isPending,
    addButtonDisabled: formState.addButtonDisabled,
    addButtonDisabledReason: formState.addButtonDisabledReason,
    submitDisabled: formState.submitDisabled,
    submitDisabledReason: formState.submitDisabledReason,
    deleteDisabled: deletionState.deleteDisabled,
    deleteDisabledReason: deletionState.deleteDisabledReason,
    selectedMembers: formState.selectedMembers,
    availableMembers: formState.availableMembers,
    membersHelpText: formState.membersHelpText,
    isPickerOpen: formState.isPickerOpen,
    removalCandidate: formState.removalCandidate,
    removalName: formState.removalName,
    clientDisplayName,
    sheetTitle: isEditing ? 'Edit client' : 'Add client',
    sheetDescription: isEditing
      ? 'Adjust display details or delete the organization.'
      : 'Register a client so projects and reporting stay organized.',
    pendingReason: PENDING_REASON,
    isDeleteDialogOpen: deletionState.isDeleteDialogOpen,
    unsavedChangesDialog: formState.unsavedChangesDialog,
    handleSheetOpenChange: formState.handleSheetOpenChange,
    handleFormSubmit: formState.handleFormSubmit,
    handlePickerOpenChange: formState.handlePickerOpenChange,
    handleAddMember: formState.handleAddMember,
    handleRequestRemoval: formState.handleRequestRemoval,
    handleCancelRemoval: formState.handleCancelRemoval,
    handleConfirmRemoval: formState.handleConfirmRemoval,
    handleRequestDelete: deletionState.handleRequestDelete,
    handleCancelDelete: deletionState.handleCancelDelete,
    handleConfirmDelete: deletionState.handleConfirmDelete,
    replaceMembers: formState.replaceMembers,
  }
}

export type {
  UseClientSheetStateArgs,
  UseClientSheetStateReturn,
  ClientMemberOption,
} from './types'

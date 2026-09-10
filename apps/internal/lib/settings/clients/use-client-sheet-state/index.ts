'use client'

import { useState } from 'react'

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
  allContacts,
  clientContacts,
  allAdminUsers,
}: UseClientSheetStateArgs): UseClientSheetStateReturn => {
  const isEditing = Boolean(client)
  const [feedback, setFeedback] = useState<string | null>(null)
  const { toast } = useToast()

  const formState = useClientSheetFormState({
    open,
    onOpenChange,
    onComplete,
    client,
    allContacts,
    clientContacts,
    allAdminUsers,
    isEditing,
    setFeedback,
    toast,
  })

  // The form state owns the save transition (it also owns the form and the
  // close guard); deletion shares the same one so both read as one operation.
  const { isSaving: isPending, startSave } = formState

  const deletionState = useClientDeletionState({
    client,
    isPending,
    startTransition: startSave,
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
    submitDisabled: formState.submitDisabled,
    submitDisabledReason: formState.submitDisabledReason,
    deleteDisabled: deletionState.deleteDisabled,
    deleteDisabledReason: deletionState.deleteDisabledReason,
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
    handleRequestDelete: deletionState.handleRequestDelete,
    handleCancelDelete: deletionState.handleCancelDelete,
    handleConfirmDelete: deletionState.handleConfirmDelete,
    // Contacts
    availableContacts: formState.availableContacts,
    selectedContacts: formState.selectedContacts,
    isContactPickerOpen: formState.isContactPickerOpen,
    contactsAddButtonDisabled: formState.contactsAddButtonDisabled,
    contactsAddButtonDisabledReason: formState.contactsAddButtonDisabledReason,
    isLoadingContacts: formState.isLoadingContacts,
    handleContactPickerOpenChange: formState.handleContactPickerOpenChange,
    handleAddContact: formState.handleAddContact,
    handleCreateContact: formState.handleCreateContact,
    handleRemoveContact: formState.handleRemoveContact,
    // Origination
    originationMode: formState.originationMode,
    selectedOriginationUser: formState.selectedOriginationUser,
    selectedOriginationContact: formState.selectedOriginationContact,
    availableOriginationUsers: formState.availableOriginationUsers,
    availableOriginationContacts: formState.availableOriginationContacts,
    isOriginationUserPickerOpen: formState.isOriginationUserPickerOpen,
    isOriginationContactPickerOpen: formState.isOriginationContactPickerOpen,
    originationPickerDisabled: formState.originationPickerDisabled,
    originationPickerDisabledReason: formState.originationPickerDisabledReason,
    originationError: formState.originationError,
    handleOriginationModeChange: formState.handleOriginationModeChange,
    handleOriginationUserPickerOpenChange:
      formState.handleOriginationUserPickerOpenChange,
    handleOriginationContactPickerOpenChange:
      formState.handleOriginationContactPickerOpenChange,
    handleSelectOriginationUser: formState.handleSelectOriginationUser,
    handleSelectOriginationContact: formState.handleSelectOriginationContact,
    handleClearOrigination: formState.handleClearOrigination,
    // Closer
    selectedCloser: formState.selectedCloser,
    availableClosers: formState.availableClosers,
    isCloserPickerOpen: formState.isCloserPickerOpen,
    closerPickerDisabled: formState.closerPickerDisabled,
    closerPickerDisabledReason: formState.closerPickerDisabledReason,
    closerError: formState.closerError,
    commissionDirty: formState.commissionDirty,
    handleCloserPickerOpenChange: formState.handleCloserPickerOpenChange,
    handleSelectCloser: formState.handleSelectCloser,
    handleClearCloser: formState.handleClearCloser,
  }
}

export type {
  UseClientSheetStateArgs,
  UseClientSheetStateReturn,
  ClientContactOption,
  OriginationContactOption,
  PartnerUserOption,
  OriginationMode,
} from './types'

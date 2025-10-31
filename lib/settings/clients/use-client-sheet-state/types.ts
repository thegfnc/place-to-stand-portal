import type { TransitionStartFunction } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { useToast } from '@/components/ui/use-toast'
import type { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import type { ClientMember, ClientRow, ClientUserSummary } from '../client-sheet-utils'
import type { ClientSheetFormValues } from '../client-sheet-schema'

type ToastFn = ReturnType<typeof useToast>['toast']
type UnsavedChangesDialog = ReturnType<
  typeof useUnsavedChangesWarning
>['dialog']

export type UseClientSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  client: ClientRow | null
  allClientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
}

export type ClientMemberOption = ClientMember

export type BaseFormState = {
  form: UseFormReturn<ClientSheetFormValues>
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  availableMembers: ClientMemberOption[]
  selectedMembers: ClientMemberOption[]
  membersHelpText: string
  isPickerOpen: boolean
  removalCandidate: ClientMemberOption | null
  removalName: string | null
  unsavedChangesDialog: UnsavedChangesDialog
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: ClientSheetFormValues) => void
  handlePickerOpenChange: (open: boolean) => void
  handleAddMember: (member: ClientMemberOption) => void
  handleRequestRemoval: (member: ClientMemberOption) => void
  handleCancelRemoval: () => void
  handleConfirmRemoval: () => void
  replaceMembers: (members: ClientMemberOption[]) => void
}

export type DeletionState = {
  isDeleteDialogOpen: boolean
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export type ClientSheetFormStateArgs = UseClientSheetStateArgs & {
  isEditing: boolean
  isPending: boolean
  startTransition: TransitionStartFunction
  setFeedback: (value: string | null) => void
  toast: ToastFn
}

export type ClientDeletionStateArgs = {
  client: ClientRow | null
  isPending: boolean
  startTransition: TransitionStartFunction
  setFeedback: (value: string | null) => void
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  toast: ToastFn
}

export type UseClientSheetStateReturn = {
  form: UseFormReturn<ClientSheetFormValues>
  isEditing: boolean
  feedback: string | null
  isPending: boolean
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  selectedMembers: ClientMemberOption[]
  availableMembers: ClientMemberOption[]
  membersHelpText: string
  isPickerOpen: boolean
  removalCandidate: ClientMemberOption | null
  removalName: string | null
  clientDisplayName: string
  sheetTitle: string
  sheetDescription: string
  pendingReason: string
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: UnsavedChangesDialog
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: ClientSheetFormValues) => void
  handlePickerOpenChange: (open: boolean) => void
  handleAddMember: (member: ClientMemberOption) => void
  handleRequestRemoval: (member: ClientMemberOption) => void
  handleCancelRemoval: () => void
  handleConfirmRemoval: () => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  replaceMembers: (members: ClientMemberOption[]) => void
}

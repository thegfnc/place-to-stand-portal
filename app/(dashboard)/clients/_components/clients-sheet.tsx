'use client'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'

import type { UseClientSheetStateArgs } from '@/lib/settings/clients/use-client-sheet-state'
import { useClientSheetState } from '@/lib/settings/clients/use-client-sheet-state'

import { ClientMemberRemovalDialog } from './client-sheet/client-member-removal-dialog'
import { ClientSheetForm } from './client-sheet/client-sheet-form'
import { ClientSheetHeader } from './client-sheet/client-sheet-header'

type ClientSheetProps = UseClientSheetStateArgs

export function ClientSheet(props: ClientSheetProps) {
  const {
    form,
    isEditing,
    feedback,
    isPending,
    addButtonDisabled,
    addButtonDisabledReason,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    selectedMembers,
    availableMembers,
    isPickerOpen,
    pendingReason,
    isDeleteDialogOpen,
    removalCandidate,
    removalName,
    clientDisplayName,
    sheetTitle,
    sheetDescription,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handlePickerOpenChange,
    handleAddMember,
    handleRequestRemoval,
    handleCancelRemoval,
    handleConfirmRemoval,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useClientSheetState(props)

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-lg'>
          <ClientSheetHeader
            title={sheetTitle}
            description={sheetDescription}
          />
          <ClientSheetForm
            form={form}
            feedback={feedback}
            isPending={isPending}
            isEditing={isEditing}
            pendingReason={pendingReason}
            addButtonDisabled={addButtonDisabled}
            addButtonDisabledReason={addButtonDisabledReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            deleteDisabled={deleteDisabled}
            deleteDisabledReason={deleteDisabledReason}
            selectedMembers={selectedMembers}
            availableMembers={availableMembers}
            isPickerOpen={isPickerOpen}
            onPickerOpenChange={handlePickerOpenChange}
            onAddMember={handleAddMember}
            onRequestRemoval={handleRequestRemoval}
            onSubmit={handleFormSubmit}
            onRequestDelete={handleRequestDelete}
            isSheetOpen={props.open}
            historyKey={props.client?.id ?? 'client:new'}
          />
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={ARCHIVE_CLIENT_DIALOG_TITLE}
        description={getArchiveClientDialogDescription(clientDisplayName)}
        confirmLabel={ARCHIVE_CLIENT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
      <ClientMemberRemovalDialog
        open={Boolean(removalCandidate)}
        isPending={isPending}
        pendingReason={pendingReason}
        memberName={removalName}
        clientDisplayName={clientDisplayName}
        onCancel={handleCancelRemoval}
        onConfirm={handleConfirmRemoval}
      />
    </>
  )
}

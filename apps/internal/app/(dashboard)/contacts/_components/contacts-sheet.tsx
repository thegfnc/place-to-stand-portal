'use client'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import {
  useContactSheetState,
  type UseContactSheetStateOptions,
} from '@/lib/settings/contacts/use-contact-sheet-state'

import { ContactSheetForm } from './contact-sheet/contact-sheet-form'
import { PromoteToUserDialog } from './contact-sheet/promote-to-user-dialog'



const ARCHIVE_CONTACT_DIALOG_TITLE = 'Archive contact?'
const ARCHIVE_CONTACT_CONFIRM_LABEL = 'Archive'

function getArchiveContactDialogDescription(displayName: string) {
  return `Archiving ${displayName} hides it from active views but preserves the record.`
}

type ContactsSheetProps = UseContactSheetStateOptions

export function ContactsSheet(props: ContactsSheetProps) {
  const { open, contact } = props
  const {
    form,
    feedback,
    isPending,
    isEditing,
    pendingReason,
    sheetTitle,
    contactDisplayName,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    isPromoteDialogOpen,
    setIsPromoteDialogOpen,
    isClientPickerOpen,
    setIsClientPickerOpen,
    selectedClients,
    availableClients,
    addClientButtonDisabled,
    addClientButtonDisabledReason,
    hasPortalAccess,
    promoteDisabled,
    promoteDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestPromote,
    handleConfirmPromote,
    handleAddClient,
    handleRemoveClient,
  } = useContactSheetState(props)

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='lg'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader entity='contact' title={sheetTitle} />
          <ContactSheetForm
            form={form}
            feedback={feedback}
            isPending={isPending}
            isEditing={isEditing}
            pendingReason={pendingReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            deleteDisabled={deleteDisabled}
            deleteDisabledReason={deleteDisabledReason}
            onSubmit={handleFormSubmit}
            onRequestDelete={handleRequestDelete}
            isSheetOpen={open}
            historyKey={contact?.id ?? 'contact:new'}
            selectedClients={selectedClients}
            availableClients={availableClients}
            addClientButtonDisabled={addClientButtonDisabled}
            addClientButtonDisabledReason={addClientButtonDisabledReason}
            isClientPickerOpen={isClientPickerOpen}
            onClientPickerOpenChange={setIsClientPickerOpen}
            onAddClient={handleAddClient}
            onRemoveClient={handleRemoveClient}
            promoteDisabled={promoteDisabled}
            promoteDisabledReason={promoteDisabledReason}
            onRequestPromote={handleRequestPromote}
            hasPortalAccess={hasPortalAccess}
          />
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={ARCHIVE_CONTACT_DIALOG_TITLE}
        description={getArchiveContactDialogDescription(contactDisplayName)}
        confirmLabel={ARCHIVE_CONTACT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <PromoteToUserDialog
        open={isPromoteDialogOpen}
        onOpenChange={setIsPromoteDialogOpen}
        contactName={contactDisplayName}
        contactEmail={contact?.email ?? ''}
        linkedClientCount={selectedClients.length}
        isPending={isPending}
        onConfirm={handleConfirmPromote}
      />
      {unsavedChangesDialog}
    </>
  )
}

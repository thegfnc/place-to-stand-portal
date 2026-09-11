'use client'

import { useCallback, useMemo, useState } from 'react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Form } from '@/components/ui/form'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'

import type { UserSheetProps } from './types'
import { UserSheetFormFields } from './user-sheet-form-fields'
import { useUserSheetState } from './use-user-sheet-state'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { buildDeleteDialogDescription } from '@/lib/settings/users/state/constants'

const USER_FORM_ID = 'user-form'

export function UserSheet(props: UserSheetProps) {
  const {
    form,
    isEditing,
    isPending,
    feedback,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
    emailDisabled,
    emailDisabledReason,
    roleDisabled,
    roleDisabledReason,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    accessToggleDisabled,
    accessToggleDisabledReason,
    isDeleteDialogOpen,
    pendingReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useUserSheetState(props)

  // Block Save while an avatar upload is in flight — submitting mid-upload
  // would persist the previous avatar and orphan the staged upload.
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const effectiveSubmitDisabled = submitDisabled || isAvatarUploading
  const effectiveSubmitDisabledReason = isAvatarUploading
    ? 'Waiting for the avatar upload to finish.'
    : submitDisabledReason

  const handleSave = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: props.open,
    canSave: !effectiveSubmitDisabled,
    onSave: handleSave,
    historyKey: props.user?.id ?? 'user:new',
  })

  const deleteDialogDescription = useMemo(
    () => buildDeleteDialogDescription(props.user, props.assignments),
    [props.assignments, props.user]
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='lg'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='user'
            title={isEditing ? 'Edit user' : 'Add user'}
          />
          <Form {...form}>
            <div className='flex-1 overflow-y-auto'>
              <form
                id={USER_FORM_ID}
                onSubmit={form.handleSubmit(handleFormSubmit)}
                className='flex flex-col gap-6 px-6 pt-6 pb-8'
              >
                <UserSheetFormFields
                  form={form}
                  isPending={isPending}
                  pendingReason={pendingReason}
                  emailDisabled={emailDisabled}
                  emailDisabledReason={emailDisabledReason}
                  roleDisabled={roleDisabled}
                  roleDisabledReason={roleDisabledReason}
                  accessToggleDisabled={accessToggleDisabled}
                  accessToggleDisabledReason={accessToggleDisabledReason}
                  avatarFieldKey={avatarFieldKey}
                  avatarInitials={avatarInitials}
                  onAvatarUploadingChange={setIsAvatarUploading}
                  avatarDisplayName={avatarDisplayName}
                  targetUserId={props.user?.id ?? null}
                  isEditing={isEditing}
                  isSheetOpen={props.open}
                />
                {feedback ? (
                  <p className='text-destructive text-sm'>{feedback}</p>
                ) : null}
              </form>
            </div>
            <SheetFormFooter
              formId={USER_FORM_ID}
              saveLabel={isEditing ? 'Save changes' : 'Send invite'}
              submitDisabled={effectiveSubmitDisabled}
              submitDisabledReason={effectiveSubmitDisabledReason}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              isEditing={isEditing}
              deleteDisabled={deleteDisabled}
              deleteDisabledReason={deleteDisabledReason}
              onRequestDelete={handleRequestDelete}
              deleteAriaLabel='Archive user'
            />
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Archive user?'
        description={deleteDialogDescription}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

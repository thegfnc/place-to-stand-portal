'use client'

import { useCallback, useMemo } from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Form } from '@/components/ui/form'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import type { UserSheetProps } from './types'
import { UserSheetFormFields } from './user-sheet-form-fields'
import { useUserSheetState } from './use-user-sheet-state'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { buildDeleteDialogDescription } from '@/lib/settings/users/state/constants'

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
    isDeleteDialogOpen,
    pendingReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useUserSheetState(props)

  const handleSave = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: props.open,
    canSave: !submitDisabled,
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
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-lg'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>{isEditing ? 'Edit user' : 'Add user'}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the member's access level or reset their credentials."
                : 'Provision a new teammate with immediate access to the portal.'}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className='flex flex-1 flex-col gap-5 px-6 pb-32'
            >
              <UserSheetFormFields
                form={form}
                isPending={isPending}
                pendingReason={pendingReason}
                emailDisabled={emailDisabled}
                emailDisabledReason={emailDisabledReason}
                roleDisabled={roleDisabled}
                roleDisabledReason={roleDisabledReason}
                avatarFieldKey={avatarFieldKey}
                avatarInitials={avatarInitials}
                avatarDisplayName={avatarDisplayName}
                targetUserId={props.user?.id ?? null}
                isEditing={isEditing}
                isSheetOpen={props.open}
              />
              {feedback ? (
                <p className='text-destructive text-sm'>{feedback}</p>
              ) : null}
              <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-lg'>
                <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
                  <div className='flex items-center gap-2'>
                    <DisabledFieldTooltip
                      disabled={submitDisabled}
                      reason={submitDisabledReason}
                    >
                      <Button
                        type='submit'
                        disabled={submitDisabled}
                        aria-label={`${isEditing ? 'Save changes' : 'Send invite'} (⌘S / Ctrl+S)`}
                        title={`${isEditing ? 'Save changes' : 'Send invite'} (⌘S / Ctrl+S)`}
                      >
                        {isEditing ? 'Save changes' : 'Send invite'}
                      </Button>
                    </DisabledFieldTooltip>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={undo}
                      disabled={!canUndo}
                      aria-label='Undo (⌘Z / Ctrl+Z)'
                      title='Undo (⌘Z / Ctrl+Z)'
                    >
                      <Undo2 className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={redo}
                      disabled={!canRedo}
                      aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                      title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                    >
                      <Redo2 className='h-4 w-4' />
                    </Button>
                  </div>
                  {isEditing ? (
                    <DisabledFieldTooltip
                      disabled={deleteDisabled}
                      reason={deleteDisabledReason}
                    >
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        onClick={handleRequestDelete}
                        disabled={deleteDisabled}
                        aria-label='Archive user'
                        title='Archive user'
                      >
                        <Archive className='h-4 w-4' />
                      </Button>
                    </DisabledFieldTooltip>
                  ) : null}
                </div>
              </div>
            </form>
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

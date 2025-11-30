import { ConfirmDialog } from '@/components/ui/confirm-dialog'
export type ProjectSheetDialogsProps = {
  isDeleteDialogOpen: boolean
  isPending: boolean
  unsavedChangesDialog: React.ReactNode
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

export function ProjectSheetDialogs(props: ProjectSheetDialogsProps) {
  const {
    isDeleteDialogOpen,
    isPending,
    unsavedChangesDialog,
    onCancelDelete,
    onConfirmDelete,
  } = props

  return (
    <>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Archive project?'
        description='Archiving this project hides it from active views but keeps the history intact.'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

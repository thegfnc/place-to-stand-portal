import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type HourBlockArchiveDialogProps = {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function HourBlockArchiveDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: HourBlockArchiveDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title='Archive hour block?'
      description='Archiving this block hides it from active tracking while retaining historical activity.'
      confirmLabel='Archive'
      confirmVariant='destructive'
      confirmDisabled={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

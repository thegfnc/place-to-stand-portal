import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import type { ProjectWithClient } from './types'

type ProjectLifecycleDialogsProps = {
  deleteTarget: ProjectWithClient | null
  destroyTarget: ProjectWithClient | null
  isPending: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelDestroy: () => void
  onConfirmDestroy: () => void
}

export function ProjectLifecycleDialogs({
  deleteTarget,
  destroyTarget,
  isPending,
  onCancelDelete,
  onConfirmDelete,
  onCancelDestroy,
  onConfirmDestroy,
}: ProjectLifecycleDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive project?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from active views but keeps the history intact.`
            : 'Archiving this project hides it from active views but keeps the history intact.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete project?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this project and its memberships. This action cannot be undone.`
            : 'Permanently deleting this project removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={onCancelDestroy}
        onConfirm={onConfirmDestroy}
      />
    </>
  )
}

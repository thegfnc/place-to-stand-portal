import { useMemo } from 'react'

import type { UserAssignments } from './types'
import type { UserRow } from './types'
import type { DeleteDialogState } from './types'
import { useDeleteUserAction } from './user-mutation/use-delete-user-action'
import { useDestroyUserAction } from './user-mutation/use-destroy-user-action'
import { useRestoreUserAction } from './user-mutation/use-restore-user-action'
import { useSetUserDisabledAction } from './user-mutation/use-set-user-disabled-action'

export type UserMutationState = {
  deleteDialog: DeleteDialogState
  destroyDialog: DeleteDialogState
  disableDialog: DeleteDialogState
  requestDelete: (user: UserRow) => void
  requestDestroy: (user: UserRow) => void
  restore: (user: UserRow) => void
  setDisabled: (user: UserRow, disabled: boolean) => void
  isPending: boolean
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  pendingDisableId: string | null
  selfDeleteReason: string
}

type UseUserMutationStateArgs = {
  currentUserId: string
  assignments: UserAssignments
}

export const useUserMutationState = ({
  currentUserId,
  assignments,
}: UseUserMutationStateArgs): UserMutationState => {
  const deleteAction = useDeleteUserAction({ currentUserId, assignments })
  const destroyAction = useDestroyUserAction()
  const restoreAction = useRestoreUserAction()
  const disableAction = useSetUserDisabledAction()

  const isPending = useMemo(
    () =>
      deleteAction.isPending ||
      destroyAction.isPending ||
      restoreAction.isPending ||
      disableAction.isPending,
    [
      deleteAction.isPending,
      destroyAction.isPending,
      restoreAction.isPending,
      disableAction.isPending,
    ],
  )

  return {
    deleteDialog: deleteAction.deleteDialog,
    destroyDialog: destroyAction.destroyDialog,
    disableDialog: disableAction.disableDialog,
    requestDelete: deleteAction.requestDelete,
    requestDestroy: destroyAction.requestDestroy,
    restore: restoreAction.restore,
    setDisabled: disableAction.setDisabled,
    isPending,
    pendingDeleteId: deleteAction.pendingDeleteId,
    pendingRestoreId: restoreAction.pendingRestoreId,
    pendingDestroyId: destroyAction.pendingDestroyId,
    pendingDisableId: disableAction.pendingDisableId,
    selfDeleteReason: deleteAction.notifySelfDeleteReason,
  }
}

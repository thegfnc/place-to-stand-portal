import { useMemo } from 'react'

import type { UserAssignments } from './types'
import type { UserRow } from './types'
import type { DeleteDialogState } from './types'
import { useDeleteUserAction } from './user-mutation/use-delete-user-action'
import { useDestroyUserAction } from './user-mutation/use-destroy-user-action'
import { useRestoreUserAction } from './user-mutation/use-restore-user-action'

export type UserMutationState = {
  deleteDialog: DeleteDialogState
  destroyDialog: DeleteDialogState
  requestDelete: (user: UserRow) => void
  requestDestroy: (user: UserRow) => void
  restore: (user: UserRow) => void
  isPending: boolean
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
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

  const isPending = useMemo(
    () =>
      deleteAction.isPending ||
      destroyAction.isPending ||
      restoreAction.isPending,
    [deleteAction.isPending, destroyAction.isPending, restoreAction.isPending],
  )

  return {
    deleteDialog: deleteAction.deleteDialog,
    destroyDialog: destroyAction.destroyDialog,
    requestDelete: deleteAction.requestDelete,
    requestDestroy: destroyAction.requestDestroy,
    restore: restoreAction.restore,
    isPending,
    pendingDeleteId: deleteAction.pendingDeleteId,
    pendingRestoreId: restoreAction.pendingRestoreId,
    pendingDestroyId: destroyAction.pendingDestroyId,
    selfDeleteReason: deleteAction.notifySelfDeleteReason,
  }
}

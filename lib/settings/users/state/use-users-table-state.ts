import { useUsersSheetState } from './use-users-sheet-state'
import { useUserMutationState } from './use-user-mutation-state'
import { useUserRowsState } from './use-user-rows-state'
import type { UseUsersTableStateArgs, UsersTableState } from './types'

export type {
  UserAssignments,
  UserRowState,
  UserStatus,
  DeleteDialogState,
  SheetState,
} from './types'

export const useUsersTableState = ({
  users,
  currentUserId,
  assignments,
}: UseUsersTableStateArgs): UsersTableState => {
  const { sheet, openCreate, editUser } = useUsersSheetState()
  const mutationState = useUserMutationState({ currentUserId, assignments })

  const rows = useUserRowsState({
    users,
    currentUserId,
    isPending: mutationState.isPending,
    pendingDeleteId: mutationState.pendingDeleteId,
    pendingRestoreId: mutationState.pendingRestoreId,
    pendingDestroyId: mutationState.pendingDestroyId,
    editUser,
    restoreUser: mutationState.restore,
    requestDelete: mutationState.requestDelete,
    requestDestroy: mutationState.requestDestroy,
    selfDeleteReason: mutationState.selfDeleteReason,
  })

  return {
    rows,
    sheet,
    deleteDialog: mutationState.deleteDialog,
    destroyDialog: mutationState.destroyDialog,
    onOpenCreate: openCreate,
    selfDeleteReason: mutationState.selfDeleteReason,
    isPending: mutationState.isPending,
  }
}

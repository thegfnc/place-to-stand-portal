import { useMemo } from 'react'

import { PENDING_REASON } from './constants'
import type { UserRow, UserRowState } from './types'

const sortUsersByCreatedAt = (users: UserRow[]) =>
  [...users].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

type UseUserRowsStateArgs = {
  users: UserRow[]
  currentUserId: string
  isPending: boolean
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  editUser: (user: UserRow) => void
  restoreUser: (user: UserRow) => void
  requestDelete: (user: UserRow) => void
  requestDestroy: (user: UserRow) => void
  selfDeleteReason: string
}

export const useUserRowsState = ({
  users,
  currentUserId,
  isPending,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  editUser,
  restoreUser,
  requestDelete,
  requestDestroy,
  selfDeleteReason,
}: UseUserRowsStateArgs): UserRowState[] => {
  const sortedUsers = useMemo(() => sortUsersByCreatedAt(users), [users])

  return useMemo(
    () =>
      sortedUsers.map(user => {
        const isDeleting = isPending && pendingDeleteId === user.id
        const isRestoring = isPending && pendingRestoreId === user.id
        const isDestroying = isPending && pendingDestroyId === user.id

        const deleteDisabled =
          isDeleting ||
          isRestoring ||
          isDestroying ||
          user.id === currentUserId ||
          Boolean(user.deleted_at)
        const restoreDisabled = isRestoring || isDeleting || isDestroying
        const editDisabled = isDeleting || isRestoring || isDestroying

        const deleteDisabledReason = deleteDisabled
          ? isDeleting || isRestoring || isDestroying
            ? PENDING_REASON
            : user.id === currentUserId
              ? selfDeleteReason
              : null
          : null

        const destroyDisabled =
          isDestroying || isDeleting || isRestoring || !user.deleted_at
        const destroyDisabledReason = destroyDisabled
          ? !user.deleted_at
            ? 'Archive the user before permanently deleting.'
            : PENDING_REASON
          : null

        const status = user.deleted_at
          ? ({ label: 'Inactive', tone: 'inactive' } as const)
          : ({ label: 'Active', tone: 'active' } as const)

        return {
          user,
          status,
          isDeleting,
          isRestoring,
          isDestroying,
          deleteDisabled,
          deleteDisabledReason,
          restoreDisabled,
          restoreDisabledReason: restoreDisabled ? PENDING_REASON : null,
          editDisabled,
          editDisabledReason: editDisabled ? PENDING_REASON : null,
          onEdit: () => editUser(user),
          onRestore: () => restoreUser(user),
          onRequestDelete: () => requestDelete(user),
          destroyDisabled,
          destroyDisabledReason,
          onRequestDestroy: () => requestDestroy(user),
        }
      }),
    [
      currentUserId,
      editUser,
      isPending,
      pendingDeleteId,
      pendingDestroyId,
      pendingRestoreId,
      requestDelete,
      requestDestroy,
      restoreUser,
      selfDeleteReason,
      sortedUsers,
    ]
  )
}

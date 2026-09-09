import type { DbUser } from '@/lib/types'

export type UserRow = DbUser

export type UserAssignments = Record<
  string,
  { clients: number; projects: number; tasks: number }
>

export type UserRowState = {
  user: UserRow
  isDeleting: boolean
  isRestoring: boolean
  isDestroying: boolean
  isTogglingAccess: boolean
  accessEnabled: boolean
  accessToggleDisabled: boolean
  accessToggleDisabledReason: string | null
  onToggleAccess: (enabled: boolean) => void
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  restoreDisabled: boolean
  restoreDisabledReason: string | null
  editDisabled: boolean
  editDisabledReason: string | null
  onEdit: () => void
  onRestore: () => void
  onRequestDelete: () => void
  destroyDisabled: boolean
  destroyDisabledReason: string | null
  onRequestDestroy: () => void
}

export type UseUsersTableStateArgs = {
  users: UserRow[]
  currentUserId: string
  assignments: UserAssignments
  /**
   * User resolved server-side from `?user=`, used when the paginated list
   * doesn't contain the linked row.
   */
  deepLinkedUser?: UserRow | null
}

export type DeleteDialogState = {
  open: boolean
  description: string
  confirmDisabled: boolean
  onCancel: () => void
  onConfirm: () => void
}

export type SheetState = {
  open: boolean
  selectedUser: UserRow | null
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export type UsersTableState = {
  rows: UserRowState[]
  sheet: SheetState
  deleteDialog: DeleteDialogState
  destroyDialog: DeleteDialogState
  disableDialog: DeleteDialogState
  onOpenCreate: () => void
  selfDeleteReason: string
  isPending: boolean
}

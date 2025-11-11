import type { Database } from '@/lib/supabase/types'

export type UserRow = Database['public']['Tables']['users']['Row']

export type UserAssignments = Record<
  string,
  { clients: number; projects: number; tasks: number }
>

export type UserStatus = { label: string; tone: 'active' | 'inactive' }

export type UserRowState = {
  user: UserRow
  status: UserStatus
  isDeleting: boolean
  isRestoring: boolean
  isDestroying: boolean
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
  onOpenCreate: () => void
  selfDeleteReason: string
  isPending: boolean
}

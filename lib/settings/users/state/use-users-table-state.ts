import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'

import {
  restoreUser,
  softDeleteUser,
} from '@/app/(dashboard)/settings/users/actions'
import type { Database } from '@/supabase/types/database'

type UserRow = Database['public']['Tables']['users']['Row']

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
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  restoreDisabled: boolean
  restoreDisabledReason: string | null
  editDisabled: boolean
  editDisabledReason: string | null
  onEdit: () => void
  onRestore: () => void
  onRequestDelete: () => void
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

type SheetState = {
  open: boolean
  selectedUser: UserRow | null
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type UsersTableState = {
  rows: UserRowState[]
  sheet: SheetState
  deleteDialog: DeleteDialogState
  onOpenCreate: () => void
  selfDeleteReason: string
}

const DEFAULT_ASSIGNMENTS = { clients: 0, projects: 0, tasks: 0 }

const formatCount = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

const buildDialogDescription = (
  target: UserRow | null,
  assignments: UserAssignments
) => {
  if (!target) {
    return 'Deleting this user removes their access but keeps historical records.'
  }

  const summary = assignments[target.id] ?? DEFAULT_ASSIGNMENTS
  const targetName = target.full_name ?? target.email ?? 'this user'

  return `Deleting ${targetName} removes their access. They are currently assigned to ${formatCount(summary.clients, 'client')}, ${formatCount(summary.projects, 'project')}, and ${formatCount(summary.tasks, 'task')}. Deleting this user will also remove those assignments.`
}

export const useUsersTableState = ({
  users,
  currentUserId,
  assignments,
}: UseUsersTableStateArgs): UsersTableState => {
  const router = useRouter()
  const { toast } = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const deleteTargetRef = useRef<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const pendingReason = 'Please wait for the current request to finish.'
  const selfDeleteReason = 'You cannot delete your own account.'

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  )

  const notifySelfDeleteBlocked = useCallback(() => {
    toast({
      title: 'Cannot delete your own account',
      description:
        'Switch to another administrator before removing your access.',
      variant: 'destructive',
    })
  }, [toast])

  const handleOpenCreate = useCallback(() => {
    setSelectedUser(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = useCallback((user: UserRow) => {
    setSelectedUser(user)
    setSheetOpen(true)
  }, [])

  const handleSheetComplete = useCallback(() => {
    setSheetOpen(false)
    void router.refresh()
  }, [router])

  const handleSheetOpenChange = useCallback((next: boolean) => {
    setSheetOpen(next)
    if (!next) {
      setSelectedUser(null)
    }
  }, [])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }, [isPending])

  const handleRequestDelete = useCallback(
    (user: UserRow) => {
      if (user.id === currentUserId) {
        notifySelfDeleteBlocked()
        return
      }

      if (user.deleted_at || isPending) {
        return
      }

      setDeleteTarget(user)
    },
    [currentUserId, isPending, notifySelfDeleteBlocked]
  )

  const handleConfirmDelete = useCallback(() => {
    setDeleteTarget(prev => {
      if (!prev) {
        return prev
      }

      if (prev.id === currentUserId) {
        notifySelfDeleteBlocked()
        return null
      }

      if (prev.deleted_at) {
        return null
      }

      const user = prev
      setPendingDeleteId(user.id)
      startTransition(async () => {
        try {
          const result = await softDeleteUser({ id: user.id })

          if (result.error) {
            toast({
              title: 'Unable to delete user',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          toast({
            title: 'User deleted',
            description: `${user.full_name ?? user.email} can no longer access the portal.`,
          })
          router.refresh()
        } finally {
          setPendingDeleteId(null)
        }
      })

      return null
    })
  }, [currentUserId, notifySelfDeleteBlocked, router, startTransition, toast])

  const handleRestore = useCallback(
    (user: UserRow) => {
      if (!user.deleted_at) {
        return
      }

      setPendingRestoreId(user.id)
      startTransition(async () => {
        try {
          const result = await restoreUser({ id: user.id })

          if (result.error) {
            toast({
              title: 'Unable to restore user',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          toast({
            title: 'User restored',
            description: `${user.full_name ?? user.email} can access the portal again.`,
          })
          router.refresh()
        } finally {
          setPendingRestoreId(null)
        }
      })
    },
    [router, startTransition, toast]
  )

  useEffect(() => {
    if (deleteTarget && deleteTargetRef.current !== deleteTarget) {
      deleteTargetRef.current = deleteTarget
    }
  }, [deleteTarget])

  const dialogTarget = deleteTarget ?? deleteTargetRef.current

  const rows = useMemo<UserRowState[]>(
    () =>
      sortedUsers.map(user => {
        const isDeleting = isPending && pendingDeleteId === user.id
        const isRestoring = isPending && pendingRestoreId === user.id

        const deleteDisabled =
          isDeleting ||
          isRestoring ||
          user.id === currentUserId ||
          Boolean(user.deleted_at)
        const restoreDisabled = isRestoring || isDeleting
        const editDisabled = isDeleting || isRestoring

        const deleteDisabledReason = deleteDisabled
          ? isDeleting || isRestoring
            ? pendingReason
            : user.id === currentUserId
              ? selfDeleteReason
              : null
          : null

        const status: UserStatus = user.deleted_at
          ? { label: 'Inactive', tone: 'inactive' }
          : { label: 'Active', tone: 'active' }

        return {
          user,
          status,
          isDeleting,
          isRestoring,
          deleteDisabled,
          deleteDisabledReason,
          restoreDisabled,
          restoreDisabledReason: restoreDisabled ? pendingReason : null,
          editDisabled,
          editDisabledReason: editDisabled ? pendingReason : null,
          onEdit: () => handleEdit(user),
          onRestore: () => handleRestore(user),
          onRequestDelete: () => handleRequestDelete(user),
        }
      }),
    [
      currentUserId,
      handleEdit,
      handleRequestDelete,
      handleRestore,
      isPending,
      pendingDeleteId,
      pendingReason,
      pendingRestoreId,
      selfDeleteReason,
      sortedUsers,
    ]
  )

  const deleteDialog: DeleteDialogState = {
    open: Boolean(deleteTarget),
    description: buildDialogDescription(dialogTarget, assignments),
    confirmDisabled: isPending,
    onCancel: handleCancelDelete,
    onConfirm: handleConfirmDelete,
  }

  const sheet: SheetState = {
    open: sheetOpen,
    selectedUser,
    onOpenChange: handleSheetOpenChange,
    onComplete: handleSheetComplete,
  }

  return {
    rows,
    sheet,
    deleteDialog,
    onOpenCreate: handleOpenCreate,
    selfDeleteReason,
  }
}

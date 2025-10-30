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
  destroyUser,
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
  destroyDialog: DeleteDialogState
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

const buildDestroyDialogDescription = (target: UserRow | null) => {
  if (!target) {
    return 'Permanently deleting a user removes their profile, memberships, and activity history. This cannot be undone.'
  }

  const targetName = target.full_name ?? target.email ?? 'this user'

  return `Permanently deleting ${targetName} removes their profile, memberships, and activity history. This action cannot be undone.`
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
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<UserRow | null>(null)
  const destroyTargetRef = useRef<UserRow | null>(null)
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
    deleteTargetRef.current = null
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
    if (isPending) {
      return
    }

    const target = deleteTarget ?? deleteTargetRef.current

    if (!target) {
      return
    }

    if (target.id === currentUserId) {
      notifySelfDeleteBlocked()
      setDeleteTarget(null)
      deleteTargetRef.current = null
      return
    }

    if (target.deleted_at) {
      setDeleteTarget(null)
      deleteTargetRef.current = null
      return
    }

    setDeleteTarget(null)
    setPendingDeleteId(target.id)

    startTransition(async () => {
      try {
        const result = await softDeleteUser({ id: target.id })

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
          description: `${target.full_name ?? target.email} can no longer access the portal.`,
        })
        router.refresh()
      } finally {
        setPendingDeleteId(null)
        deleteTargetRef.current = null
      }
    })
  }, [
    currentUserId,
    deleteTarget,
    isPending,
    notifySelfDeleteBlocked,
    router,
    startTransition,
    toast,
  ])

  const handleCancelDestroy = useCallback(() => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
    destroyTargetRef.current = null
  }, [isPending])

  const handleRequestDestroy = useCallback(
    (user: UserRow) => {
      if (!user.deleted_at || isPending) {
        return
      }

      setDestroyTarget(user)
    },
    [isPending]
  )

  const handleConfirmDestroy = useCallback(() => {
    if (isPending) {
      return
    }

    const target = destroyTarget ?? destroyTargetRef.current

    if (!target) {
      return
    }

    if (!target.deleted_at) {
      setDestroyTarget(null)
      destroyTargetRef.current = null
      return
    }

    setDestroyTarget(null)
    setPendingDestroyId(target.id)

    startTransition(async () => {
      try {
        const result = await destroyUser({ id: target.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete user',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'User permanently deleted',
          description: `${target.full_name ?? target.email} has been removed from the portal.`,
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
        destroyTargetRef.current = null
      }
    })
  }, [destroyTarget, isPending, router, startTransition, toast])

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

  useEffect(() => {
    if (destroyTarget && destroyTargetRef.current !== destroyTarget) {
      destroyTargetRef.current = destroyTarget
    }
  }, [destroyTarget])

  const dialogTarget = deleteTarget ?? deleteTargetRef.current
  const destroyDialogTarget = destroyTarget ?? destroyTargetRef.current

  const rows = useMemo<UserRowState[]>(
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
            ? pendingReason
            : user.id === currentUserId
              ? selfDeleteReason
              : null
          : null

        const destroyDisabled =
          isDestroying || isDeleting || isRestoring || !user.deleted_at
        const destroyDisabledReason = destroyDisabled
          ? !user.deleted_at
            ? 'Archive the user before permanently deleting.'
            : pendingReason
          : null

        const status: UserStatus = user.deleted_at
          ? { label: 'Inactive', tone: 'inactive' }
          : { label: 'Active', tone: 'active' }

        return {
          user,
          status,
          isDeleting,
          isRestoring,
          isDestroying,
          deleteDisabled,
          deleteDisabledReason,
          restoreDisabled,
          restoreDisabledReason: restoreDisabled ? pendingReason : null,
          editDisabled,
          editDisabledReason: editDisabled ? pendingReason : null,
          onEdit: () => handleEdit(user),
          onRestore: () => handleRestore(user),
          onRequestDelete: () => handleRequestDelete(user),
          destroyDisabled,
          destroyDisabledReason,
          onRequestDestroy: () => handleRequestDestroy(user),
        }
      }),
    [
      currentUserId,
      handleEdit,
      handleRequestDestroy,
      handleRequestDelete,
      handleRestore,
      isPending,
      pendingDestroyId,
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

  const destroyDialog: DeleteDialogState = {
    open: Boolean(destroyTarget),
    description: buildDestroyDialogDescription(destroyDialogTarget),
    confirmDisabled: isPending,
    onCancel: handleCancelDestroy,
    onConfirm: handleConfirmDestroy,
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
    destroyDialog,
    onOpenCreate: handleOpenCreate,
    selfDeleteReason,
  }
}

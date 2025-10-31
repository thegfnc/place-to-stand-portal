import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { SheetState, UserRow } from './types'

type UsersSheetController = {
  sheet: SheetState
  openCreate: () => void
  editUser: (user: UserRow) => void
}

export const useUsersSheetState = (): UsersSheetController => {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const router = useRouter()

  const handleSheetComplete = useCallback(() => {
    setSheetOpen(false)
    void router.refresh()
  }, [router])

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedUser(null)
    }
  }, [])

  const handleOpenCreate = useCallback(() => {
    setSelectedUser(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = useCallback((user: UserRow) => {
    setSelectedUser(user)
    setSheetOpen(true)
  }, [])

  const sheet: SheetState = {
    open: sheetOpen,
    selectedUser,
    onOpenChange: handleSheetOpenChange,
    onComplete: handleSheetComplete,
  }

  return {
    sheet,
    openCreate: handleOpenCreate,
    editUser: handleEdit,
  }
}

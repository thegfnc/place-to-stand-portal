import type { DbUser } from '@/lib/types'
import type { UserAssignments } from '@/lib/settings/users/state/types'

export type UserRow = DbUser

export type UserSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  user: UserRow | null
  currentUserId: string
  assignments: UserAssignments
}

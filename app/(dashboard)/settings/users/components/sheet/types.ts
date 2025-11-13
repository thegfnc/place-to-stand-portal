import type { DbUser } from '@/lib/types'

export type UserRow = DbUser

export type UserSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  user: UserRow | null
  currentUserId: string
}

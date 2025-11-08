import type { UserRow as DrizzleUserRow } from '@/lib/db/schema'

export type UserRow = DrizzleUserRow

export type UserSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  user: UserRow | null
  currentUserId: string
}

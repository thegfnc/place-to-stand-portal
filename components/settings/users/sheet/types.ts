import type { Database } from '@/supabase/types/database'

export type UserRow = Database['public']['Tables']['users']['Row']

export type UserSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  user: UserRow | null
  currentUserId: string
}

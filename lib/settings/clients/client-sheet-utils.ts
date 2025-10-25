import type { Database } from '@/supabase/types/database'

export type ClientRow = Database['public']['Tables']['clients']['Row']

export type ClientUserSummary = {
  id: string
  email: string
  fullName: string | null
}

export type ClientMember = ClientUserSummary & {
  displayName: string
}

export const formatUserDisplayName = (user: ClientUserSummary | ClientMember) =>
  user.fullName?.trim() || user.email

export const attachDisplayName = (user: ClientUserSummary): ClientMember => ({
  ...user,
  displayName: formatUserDisplayName(user),
})

export const cloneMembers = (members: ClientMember[]): ClientMember[] =>
  members.map(member => ({ ...member }))

import type { ClientUserSummary } from '@/lib/settings/clients/client-sheet-utils'

type RawClientUser = {
  id: string
  email: string | null
  fullName: string | null
}

type RawMembersMap = Record<string, RawClientUser[]>

export function normalizeClientUsers(users: RawClientUser[]): ClientUserSummary[] {
  return users.map(user => ({
    id: user.id,
    email: user.email ?? '',
    fullName: user.fullName ?? null,
  }))
}

export function normalizeClientMembersMap(
  members: RawMembersMap
): Record<string, ClientUserSummary[]> {
  return Object.entries(members).reduce<Record<string, ClientUserSummary[]>>(
    (acc, [clientId, list]) => {
      acc[clientId] = normalizeClientUsers(list)
      return acc
    },
    {}
  )
}

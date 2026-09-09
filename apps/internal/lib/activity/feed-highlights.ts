import type { ActivityLogWithActor } from '@/lib/activity/types'

export function getActorDisplayName(log: ActivityLogWithActor): string {
  return (
    log.actor?.full_name ||
    log.actor?.email ||
    (log.actor_role ? `${log.actor_role.toLowerCase()} user` : 'System')
  )
}

export function getActorInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)

  if (!parts.length) {
    return '?'
  }

  return parts
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

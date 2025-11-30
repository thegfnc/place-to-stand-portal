import type { UserAssignments, UserRow } from './types'

export const DEFAULT_ASSIGNMENTS = { clients: 0, projects: 0, tasks: 0 }

const formatCount = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

export const PENDING_REASON = 'Please wait for the current request to finish.'
export const SELF_DELETE_REASON = 'You cannot archive your own account.'

export const buildDeleteDialogDescription = (
  target: UserRow | null,
  assignments: UserAssignments
) => {
  if (!target) {
    return 'Archiving this user removes their access but keeps historical records.'
  }

  const summary = assignments[target.id] ?? DEFAULT_ASSIGNMENTS
  const targetName = target.full_name ?? target.email ?? 'this user'

  return `Archiving ${targetName} removes their access. They are currently assigned to ${formatCount(summary.clients, 'client')}, ${formatCount(summary.projects, 'project')}, and ${formatCount(summary.tasks, 'task')}. Archiving this user will keep those assignments until permanently deleted.`
}

export const buildDestroyDialogDescription = (target: UserRow | null) => {
  if (!target) {
    return 'Permanently deleting a user removes their profile, memberships, and activity history. This cannot be undone.'
  }

  const targetName = target.full_name ?? target.email ?? 'this user'

  return `Permanently deleting ${targetName} removes their profile, memberships, and activity history. This action cannot be undone.`
}

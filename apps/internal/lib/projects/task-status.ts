// Display vocabulary, not the DB enum: ACCEPTED (accepted_at set) and
// ARCHIVED (deleted_at set) are derived states with no task_status value.
const TASK_STATUS_TOKENS = {
  ON_DECK:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  IN_PROGRESS:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  BLOCKED:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  DONE: 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  ACCEPTED:
    'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200',
  ARCHIVED:
    'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200',
} as const

const TASK_STATUS_LABELS = {
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  ACCEPTED: 'Accepted',
  ARCHIVED: 'Archived',
} as const

type TaskStatusValue = keyof typeof TASK_STATUS_TOKENS

export function getTaskStatusToken(value: string): string {
  const normalized = value.toUpperCase() as TaskStatusValue
  if (normalized in TASK_STATUS_TOKENS) {
    return TASK_STATUS_TOKENS[normalized]
  }

  return 'border border-border bg-accent text-accent-foreground'
}

export function getTaskStatusLabel(value: string): string {
  const normalized = value.toUpperCase() as TaskStatusValue
  if (normalized in TASK_STATUS_LABELS) {
    return TASK_STATUS_LABELS[normalized]
  }

  const humanized = value.replace(/_/g, ' ').trim()

  if (!humanized) {
    return 'Unknown'
  }

  return humanized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Statuses that mean the task is not finished — reaching one reopens it. */
const REOPENING_STATUSES = new Set(['ON_DECK', 'IN_PROGRESS', 'BLOCKED'])

/**
 * The single rule for `tasks.completed_at`, shared by every status write path
 * (task sheet save, board status change, and both reorder routes). Callers
 * spread the result into their `.set({...})`.
 *
 * - Entering DONE stamps the moment.
 * - Staying DONE preserves the original stamp, so editing a finished task
 *   doesn't reset its clock — the whole reason this column exists instead of
 *   reading `updated_at`.
 * - Reopening to an active status clears it.
 * - Any other value (defensive: nothing else exists today) preserves it.
 */
export function resolveCompletedAt(
  nextStatus: string,
  currentCompletedAt: string | null | undefined
): { completedAt: string | null } {
  if (nextStatus === 'DONE') {
    return { completedAt: currentCompletedAt ?? new Date().toISOString() }
  }

  if (REOPENING_STATUSES.has(nextStatus)) {
    return { completedAt: null }
  }

  return { completedAt: currentCompletedAt ?? null }
}

export { TASK_STATUS_TOKENS }

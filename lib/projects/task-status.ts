const TASK_STATUS_TOKENS = {
  BACKLOG:
    'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200',
  ON_DECK:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  IN_PROGRESS:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  BLOCKED:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  IN_REVIEW:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  DONE: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  ARCHIVED:
    'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
} as const

const TASK_STATUS_LABELS = {
  BACKLOG: 'Backlog',
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  ARCHIVED: 'Archived',
} as const

export type TaskStatusValue = keyof typeof TASK_STATUS_TOKENS

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

export { TASK_STATUS_TOKENS, TASK_STATUS_LABELS }

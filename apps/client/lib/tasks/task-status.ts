/**
 * Client-facing subset of the internal app's task status presentation
 * (`apps/internal/lib/projects/task-status.ts`). ARCHIVED is intentionally
 * absent — archived tasks are never surfaced in the portal.
 */
const TASK_STATUS_LABELS = {
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
} as const

const TASK_STATUS_TOKENS = {
  ON_DECK:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  IN_PROGRESS:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  BLOCKED:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  DONE: 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
} as const

type ClientTaskStatus = keyof typeof TASK_STATUS_LABELS

export function getTaskStatusLabel(value: string): string {
  return value in TASK_STATUS_LABELS
    ? TASK_STATUS_LABELS[value as ClientTaskStatus]
    : value
}

export function getTaskStatusToken(value: string): string {
  return value in TASK_STATUS_TOKENS
    ? TASK_STATUS_TOKENS[value as ClientTaskStatus]
    : 'border border-border bg-accent text-accent-foreground'
}

import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns'

export const TASK_DUE_TONE_CLASSES = {
  default: 'text-muted-foreground',
  caution: 'text-amber-900 dark:text-amber-200',
  overdue: 'text-destructive font-medium',
} as const

export type TaskDueTone = keyof typeof TASK_DUE_TONE_CLASSES

export type TaskDueMeta = {
  label: string
  tone: TaskDueTone
}

type TaskDueMetaOptions = {
  status?: string | null
}

export function getTaskDueMeta(
  dueOn: string | null,
  options: TaskDueMetaOptions = {}
): TaskDueMeta {
  if (!dueOn) {
    return { label: 'No set due date', tone: 'default' }
  }

  const parsed = parseISO(dueOn)

  if (Number.isNaN(parsed.getTime())) {
    return { label: dueOn, tone: 'default' }
  }

  const normalizedStatus = options.status?.toUpperCase() ?? null
  const isDone = normalizedStatus === 'DONE'

  if (isDone) {
    return {
      label: `Due ${format(parsed, 'MMM d')}`,
      tone: 'default',
    }
  }

  if (isToday(parsed)) {
    return { label: 'Due today', tone: 'caution' }
  }

  if (isTomorrow(parsed)) {
    return { label: 'Due tomorrow', tone: 'caution' }
  }

  const daysUntilDue = differenceInCalendarDays(parsed, new Date())

  if (daysUntilDue < 0) {
    return {
      label: `Overdue - ${format(parsed, 'MMM d, yyyy')}`,
      tone: 'overdue',
    }
  }

  if (daysUntilDue <= 3) {
    return {
      label: `Due ${format(parsed, 'MMM d')}`,
      tone: 'caution',
    }
  }

  return {
    label: `Due ${format(parsed, 'MMM d')}`,
    tone: 'default',
  }
}

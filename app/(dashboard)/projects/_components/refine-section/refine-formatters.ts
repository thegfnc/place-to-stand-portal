"use client"

import { format, formatDistanceToNow, parseISO } from "date-fns"

export function formatDueDate(value: string | null) {
  if (!value) {
    return "—"
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return format(parsed, "MMM d, yyyy")
  } catch {
    return value
  }
}

export function formatUpdatedAt(value: string) {
  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return formatDistanceToNow(parsed, { addSuffix: true })
  } catch {
    return value
  }
}


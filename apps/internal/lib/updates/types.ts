import type { clientUpdates } from '@/lib/db/schema'

export type ClientUpdateRecipients = {
  to: string[]
  cc: string[]
}

export type ClientUpdateStatus = 'DRAFT' | 'SENT'

/**
 * One thing we are telling the client. Anchored to a task when there is one
 * so the email can link into the client portal; `taskId` null is allowed for
 * work that never had a task ("we also removed a duplicate title").
 */
export type ClientUpdateItem = {
  /** Stable key for editing; not the task id. */
  id: string
  taskId: string | null
  /** The bold run-in: "Site speed." */
  label: string
  /** Minimal markdown — see `lib/updates/markdown.ts`. */
  body: string
}

type RawRow = typeof clientUpdates.$inferSelect

/**
 * The stored row with its jsonb columns narrowed. Drizzle types jsonb as
 * `unknown`; `normalizeClientUpdateRow` is the one place that coerces it so
 * every consumer downstream can trust the shape.
 */
export type ClientUpdateRow = Omit<RawRow, 'recipients' | 'items'> & {
  recipients: ClientUpdateRecipients
  items: ClientUpdateItem[]
}

const EMPTY_RECIPIENTS: ClientUpdateRecipients = { to: [], cc: [] }

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function normalizeRecipients(value: unknown): ClientUpdateRecipients {
  if (!value || typeof value !== 'object') return EMPTY_RECIPIENTS
  const record = value as Record<string, unknown>
  return { to: stringList(record.to), cc: stringList(record.cc) }
}

export function normalizeItems(value: unknown): ClientUpdateItem[] {
  if (!Array.isArray(value)) return []
  const items: ClientUpdateItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.label !== 'string')
      continue
    items.push({
      id: record.id,
      taskId: typeof record.taskId === 'string' ? record.taskId : null,
      label: record.label,
      body: typeof record.body === 'string' ? record.body : '',
    })
  }
  return items
}

export function normalizeClientUpdateRow(row: RawRow): ClientUpdateRow {
  return {
    ...row,
    recipients: normalizeRecipients(row.recipients),
    items: normalizeItems(row.items),
  }
}

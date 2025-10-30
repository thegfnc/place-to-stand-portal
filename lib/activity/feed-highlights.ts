import type { ActivityLogWithActor } from '@/lib/activity/types'

export type HighlightDetail = {
  field: string
  before: string
  after: string
}

export type HighlightFact = {
  label: string
  value: string
}

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

export function getChangedFields(
  metadata: Record<string, unknown> | null
): string[] {
  if (!metadata) {
    return []
  }

  const fields = metadata.changedFields

  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map(field => (typeof field === 'string' ? field : null))
    .filter((field): field is string => Boolean(field))
}

export function getDetailHighlights(
  metadata: Record<string, unknown> | null
): HighlightDetail[] {
  if (!metadata) {
    return []
  }

  const detailsRecord = toRecord(metadata.details)

  if (!detailsRecord) {
    return []
  }

  const before = toRecord(detailsRecord['before'])
  const after = toRecord(detailsRecord['after'])

  if (!before && !after) {
    return []
  }

  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  return Array.from(fields).map(field => ({
    field,
    before: formatDetailValue(before ? before[field] : undefined),
    after: formatDetailValue(after ? after[field] : undefined),
  }))
}

export function getFactHighlights(
  metadata: Record<string, unknown> | null
): HighlightFact[] {
  if (!metadata) {
    return []
  }

  const facts: HighlightFact[] = []

  const email = metadata.email
  if (typeof email === 'string' && email.trim()) {
    facts.push({ label: 'Email', value: email })
  }

  const role = metadata.role
  if (typeof role === 'string' && role.trim()) {
    facts.push({ label: 'Role', value: role })
  }

  const hours = metadata.hours
  if (typeof hours === 'number' && Number.isFinite(hours)) {
    facts.push({
      label: 'Hours',
      value: hours.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    })
  }

  const linkedTaskCount = metadata.linkedTaskCount
  if (typeof linkedTaskCount === 'number' && linkedTaskCount > 0) {
    facts.push({
      label: 'Linked tasks',
      value: linkedTaskCount.toString(),
    })
  }

  const passwordChanged = metadata.passwordChanged
  if (typeof passwordChanged === 'boolean' && passwordChanged) {
    facts.push({ label: 'Password', value: 'Changed' })
  }

  const assigneeRecord = toRecord(metadata.assignees)

  if (assigneeRecord) {
    const added = Array.isArray(assigneeRecord.added)
      ? (assigneeRecord.added as unknown[]).length
      : 0
    const removed = Array.isArray(assigneeRecord.removed)
      ? (assigneeRecord.removed as unknown[]).length
      : 0

    if (added > 0 || removed > 0) {
      const parts: string[] = []

      if (added > 0) {
        parts.push(`+${added}`)
      }

      if (removed > 0) {
        parts.push(`-${removed}`)
      }

      facts.push({ label: 'Assignees', value: parts.join(' / ') })
    }
  }

  return facts
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (Array.isArray(value)) {
    return value
      .map(item => formatDetailValue(item))
      .filter(Boolean)
      .join(', ')
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

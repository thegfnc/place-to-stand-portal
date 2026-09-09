import type { ActivityLogWithActor } from './types'

/**
 * Normalised view of what an activity log actually changed.
 *
 * Writers record diffs in three shapes today:
 *   1. `metadata.details = { before: {...}, after: {...} }` (most updates)
 *   2. `metadata.details = { dueOn: { from, to } }` (board due-date changes)
 *   3. `metadata.status = { from, to }` (TASK_STATUS_CHANGED)
 * plus membership deltas (`assignees` / `contractors` / `members`) and loose
 * facts (`hours`, `total`, ...). Everything funnels through here so the feed
 * renders one consistent change list regardless of which writer produced it.
 */

export type ChangeKind =
  | 'text'
  | 'longText'
  | 'richText'
  | 'date'
  | 'status'
  | 'enum'
  | 'user'
  | 'contact'
  | 'client'
  | 'project'
  | 'money'
  | 'hours'
  | 'number'
  | 'boolean'
  | 'access'

export type FieldChange = {
  key: string
  label: string
  kind: ChangeKind
  before: unknown
  after: unknown
}

export type MembershipChange = {
  key: string
  label: string
  kind: 'user' | 'text'
  added: string[]
  removed: string[]
}

export type ActivityFact = {
  label: string
  value: string
  kind?: 'money' | 'hours' | 'date' | 'text' | 'mono'
}

export type ActivityChanges = {
  fields: FieldChange[]
  memberships: MembershipChange[]
  facts: ActivityFact[]
}

type FieldSpec = { label: string; kind: ChangeKind }

/**
 * Registry of every detail key a writer emits. Unknown keys still render
 * (humanised label, text kind) so a new writer never silently disappears.
 */
const FIELD_SPECS: Record<string, FieldSpec> = {
  title: { label: 'Title', kind: 'text' },
  name: { label: 'Name', kind: 'text' },
  fullName: { label: 'Name', kind: 'text' },
  slug: { label: 'Slug', kind: 'text' },
  email: { label: 'Email', kind: 'text' },
  phone: { label: 'Phone', kind: 'text' },
  description: { label: 'Description', kind: 'richText' },
  notes: { label: 'Notes', kind: 'longText' },
  status: { label: 'Status', kind: 'status' },
  type: { label: 'Type', kind: 'enum' },
  role: { label: 'Role', kind: 'enum' },
  billingType: { label: 'Billing type', kind: 'enum' },
  billingTypeEffectiveFrom: { label: 'Billing effective from', kind: 'date' },
  dueOn: { label: 'Due date', kind: 'date' },
  startsOn: { label: 'Start date', kind: 'date' },
  endsOn: { label: 'End date', kind: 'date' },
  ownerId: { label: 'Owner', kind: 'user' },
  closerUserId: { label: 'Closer', kind: 'user' },
  originationUserId: { label: 'Originated by', kind: 'user' },
  originationContactId: { label: 'Originating contact', kind: 'contact' },
  projectId: { label: 'Project', kind: 'project' },
  clientId: { label: 'Client', kind: 'client' },
  clientName: { label: 'Client', kind: 'text' },
  invoiceNumber: { label: 'Invoice', kind: 'text' },
  hoursPurchased: { label: 'Hours purchased', kind: 'hours' },
  taxRate: { label: 'Tax rate', kind: 'text' },
  disabled: { label: 'Access', kind: 'access' },
  contactName: { label: 'Contact name', kind: 'text' },
  contactEmail: { label: 'Contact email', kind: 'text' },
  contactPhone: { label: 'Contact phone', kind: 'text' },
  companyName: { label: 'Company', kind: 'text' },
  companyWebsite: { label: 'Website', kind: 'text' },
  sourceType: { label: 'Source', kind: 'enum' },
  sourceDetail: { label: 'Source detail', kind: 'text' },
  assigneeId: { label: 'Assignee', kind: 'user' },
  occurredAt: { label: 'Occurred at', kind: 'date' },
  body: { label: 'Body', kind: 'richText' },
  company: { label: 'Company', kind: 'text' },
  source: { label: 'Source', kind: 'enum' },
  estimatedValue: { label: 'Estimated value', kind: 'money' },
  loggedOn: { label: 'Logged on', kind: 'date' },
  hours: { label: 'Hours', kind: 'hours' },
  note: { label: 'Note', kind: 'longText' },
  subject: { label: 'Subject', kind: 'text' },
  unitPrice: { label: 'Unit price', kind: 'money' },
  rate: { label: 'Rate', kind: 'number' },
  active: { label: 'Active', kind: 'boolean' },
  workerStatus: { label: 'Worker status', kind: 'enum' },
  avatarChanged: { label: 'Avatar', kind: 'boolean' },
}

/** Membership keys: `user` lists hold user ids the feed resolves, `text` lists are shown verbatim. */
const MEMBERSHIP_SPECS: Record<string, { label: string; kind: 'user' | 'text' }> = {
  assignees: { label: 'Assignees', kind: 'user' },
  contractors: { label: 'Contractors', kind: 'user' },
  members: { label: 'Members', kind: 'user' },
  attachments: { label: 'Attachments', kind: 'text' },
  recipients: { label: 'Recipients', kind: 'text' },
  taskIds: { label: 'Linked tasks', kind: 'text' },
}

export function getActivityChanges(log: ActivityLogWithActor): ActivityChanges {
  const metadata = toRecord(log.metadata)

  if (!metadata) {
    return { fields: [], memberships: [], facts: [] }
  }

  return {
    fields: collectFieldChanges(metadata),
    memberships: collectMembershipChanges(metadata),
    facts: collectFacts(log.verb, metadata),
  }
}

function collectFieldChanges(
  metadata: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = []
  const details = toRecord(metadata.details)

  if (details) {
    const before = toRecord(details.before)
    const after = toRecord(details.after)

    if (before || after) {
      // Shape 1: { before, after }
      const keys = new Set([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
      ])
      for (const key of keys) {
        changes.push(buildFieldChange(key, before?.[key], after?.[key]))
      }
    } else {
      // Shape 2: { field: { from, to } }
      for (const [key, value] of Object.entries(details)) {
        const pair = toRecord(value)
        if (pair && ('from' in pair || 'to' in pair)) {
          changes.push(buildFieldChange(key, pair.from, pair.to))
        }
      }
    }
  }

  // Shape 3: top-level status { from, to } (TASK_STATUS_CHANGED)
  const status = toRecord(metadata.status)
  if (status && ('from' in status || 'to' in status)) {
    changes.push(buildFieldChange('status', status.from, status.to))
  }

  return dedupeClientRows(changes)
}

function buildFieldChange(
  key: string,
  before: unknown,
  after: unknown
): FieldChange {
  const spec = FIELD_SPECS[key] ?? { label: humanizeKey(key), kind: 'text' }
  const kind =
    spec.kind === 'longText' && (looksLikeHtml(before) || looksLikeHtml(after))
      ? 'richText'
      : spec.kind

  return { key, label: spec.label, kind, before, after }
}

/**
 * Hour-block writers record both `clientId` and `clientName`; the name row is
 * the readable one, so drop the id row when both are present.
 */
function dedupeClientRows(changes: FieldChange[]): FieldChange[] {
  const hasClientName = changes.some(change => change.key === 'clientName')
  return hasClientName
    ? changes.filter(change => change.key !== 'clientId')
    : changes
}

function collectMembershipChanges(
  metadata: Record<string, unknown>
): MembershipChange[] {
  const changes: MembershipChange[] = []

  for (const [key, spec] of Object.entries(MEMBERSHIP_SPECS)) {
    const record = toRecord(metadata[key])
    if (!record) continue

    const added = toStringArray(record.added)
    const removed = toStringArray(record.removed)

    if (added.length || removed.length) {
      changes.push({ key, label: spec.label, kind: spec.kind, added, removed })
    }
  }

  return changes
}

/**
 * Facts are loose, non-diff metadata worth surfacing as chips. Only keys with
 * a known meaning are shown; internal ids and flags never leak into the UI.
 */
function collectFacts(
  verb: string,
  metadata: Record<string, unknown>
): ActivityFact[] {
  const facts: ActivityFact[] = []

  const push = (
    label: string,
    value: unknown,
    kind: ActivityFact['kind'] = 'text'
  ) => {
    if (value === null || value === undefined || value === '') return
    facts.push({ label, value: String(value), kind })
  }

  const hours = metadata.hours
  if (typeof hours === 'number' && Number.isFinite(hours)) {
    push('Hours', hours, 'hours')
  }
  push('Logged on', metadata.loggedOn, 'date')
  const linkedTaskCount = metadata.linkedTaskCount
  if (typeof linkedTaskCount === 'number' && linkedTaskCount > 1) {
    push('Linked tasks', linkedTaskCount)
  }

  push('Total', metadata.total, 'money')
  if (
    typeof metadata.hoursPurchased === 'number' &&
    !toRecord(metadata.details)
  ) {
    push('Hours purchased', metadata.hoursPurchased, 'hours')
  }
  push('Views', metadata.viewCount)

  push('Email', metadata.email)
  push('Role', metadata.role, 'text')
  if (metadata.passwordChanged === true) push('Password', 'Changed')
  push('Provider', metadata.provider)

  push('Repository', metadata.repoFullName, 'mono')
  if (typeof metadata.issueNumber === 'number') {
    push('Issue', `#${metadata.issueNumber}`, 'mono')
  }
  push('Model', metadata.model)
  push('Plan', metadata.planId, 'mono')

  if (typeof metadata.count === 'number' && metadata.count > 1) {
    push('Count', metadata.count)
  }
  push('Total hours', metadata.totalHours, 'hours')
  push('Stale after', typeof metadata.staleAfterHours === 'number' ? `h` : null)
  push('Form', metadata.formType)
  push('Recipients', metadata.recipientCount)
  push('Subject', metadata.subject)

  const attachmentsRemoved = metadata.attachmentsRemoved
  if (Array.isArray(attachmentsRemoved) && attachmentsRemoved.length > 0) {
    push('Attachments removed', attachmentsRemoved.length)
  }

  if (verb === 'MONTHLY_CLOSE_CLOSED' || verb === 'MONTHLY_CLOSE_REOPENED') {
    push('Billing total', metadata.combinedBillingTotal, 'money')
    push('Payout total', metadata.combinedPayoutTotal, 'money')
  }

  const task = toRecord(metadata.task)
  if (task) {
    push('Status', task.status ? humanizeEnum(String(task.status)) : null)
    push('Due', task.dueOn, 'date')
  }

  const project = toRecord(metadata.project)
  if (project?.status) push('Status', humanizeEnum(String(project.status)))

  const contact = toRecord(metadata.contact)
  if (contact) push('Email', contact.email)

  const proposal = toRecord(metadata.proposal)
  if (proposal) {
    push('Signed by', proposal.signerName)
    push('Countersigned by', proposal.countersignerName)
  }

  const update = toRecord(metadata.update)
  if (update) {
    push('Occurred', update.occurredAt, 'date')
  }

  return facts
}

// ---------------------------------------------------------------------------
// helpers

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function looksLikeHtml(value: unknown): boolean {
  return typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function humanizeEnum(value: string): string {
  const words = value.replace(/_/g, ' ').trim().toLowerCase()
  if (!words) return value
  return words
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

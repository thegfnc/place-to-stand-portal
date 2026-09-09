import 'server-only'

import { inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, projects, users } from '@/lib/db/schema'

import { toRecord } from './changes'
import type { ActivityLogWithActor, ActivityReferences } from './types'

const USER_ID_KEYS = ['ownerId', 'closerUserId', 'originationUserId']
const CONTACT_ID_KEYS = ['originationContactId']
const PROJECT_ID_KEYS = ['projectId']
const MEMBERSHIP_KEYS = ['assignees', 'contractors', 'members']

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Activity metadata stores raw ids for people, contacts and projects (so the
 * log stays truthful if a name later changes). Resolve them to display names
 * in one batched query per page so the feed never shows a bare UUID.
 */
export async function attachActivityReferences(
  logs: ActivityLogWithActor[]
): Promise<ActivityLogWithActor[]> {
  const userIds = new Set<string>()
  const contactIds = new Set<string>()
  const projectIds = new Set<string>()

  for (const log of logs) {
    collectIds(log, userIds, contactIds, projectIds)
  }

  if (!userIds.size && !contactIds.size && !projectIds.size) {
    return logs
  }

  const [userRows, contactRows, projectRows] = await Promise.all([
    userIds.size
      ? db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(inArray(users.id, Array.from(userIds)))
      : Promise.resolve([]),
    contactIds.size
      ? db
          .select({ id: contacts.id, name: contacts.name })
          .from(contacts)
          .where(inArray(contacts.id, Array.from(contactIds)))
      : Promise.resolve([]),
    projectIds.size
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, Array.from(projectIds)))
      : Promise.resolve([]),
  ])

  const references: ActivityReferences = {
    users: Object.fromEntries(
      userRows.map(row => [
        row.id,
        {
          name: row.fullName?.trim() || row.email,
          avatarUrl: row.avatarUrl,
        },
      ])
    ),
    contacts: Object.fromEntries(contactRows.map(row => [row.id, row.name])),
    projects: Object.fromEntries(projectRows.map(row => [row.id, row.name])),
  }

  return logs.map(log => ({ ...log, references }))
}

function collectIds(
  log: ActivityLogWithActor,
  userIds: Set<string>,
  contactIds: Set<string>,
  projectIds: Set<string>
) {
  const metadata = toRecord(log.metadata)
  if (!metadata) return

  for (const key of MEMBERSHIP_KEYS) {
    const record = toRecord(metadata[key])
    if (!record) continue
    for (const listKey of ['added', 'removed', 'after']) {
      const list = record[listKey]
      if (Array.isArray(list)) {
        for (const id of list) addIfUuid(userIds, id)
      }
    }
  }

  const details = toRecord(metadata.details)
  if (!details) return

  const sides = [toRecord(details.before), toRecord(details.after)].filter(
    (side): side is Record<string, unknown> => Boolean(side)
  )

  // Shape 2 ({ field: { from, to } }) never carries ids today, but scanning
  // it costs nothing and keeps a future writer from leaking UUIDs.
  if (!sides.length) {
    for (const value of Object.values(details)) {
      const pair = toRecord(value)
      if (pair) sides.push({ before: pair.from, after: pair.to })
    }
  }

  for (const side of sides) {
    for (const key of USER_ID_KEYS) addIfUuid(userIds, side[key])
    for (const key of CONTACT_ID_KEYS) addIfUuid(contactIds, side[key])
    for (const key of PROJECT_ID_KEYS) addIfUuid(projectIds, side[key])
  }
}

function addIfUuid(target: Set<string>, value: unknown) {
  if (typeof value === 'string' && UUID_RE.test(value)) {
    target.add(value)
  }
}

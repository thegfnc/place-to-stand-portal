import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { getActiveTaskProjectId } from '@/lib/data/tasks'
import { fetchFormSubmissionById } from '@/lib/data/form-submissions'
import { fetchLeadAssignees, fetchLeadById } from '@/lib/data/leads'
import { getOrCreateSalesProject } from '@/lib/leads/sales-project'
import { fetchAdminUsers } from '@/lib/data/users'
import { NotFoundError } from '@/lib/errors/http'
import { fetchClientDirectory } from '@/lib/queries/clients'
import { getContactSheetInputById } from '@/lib/queries/contacts'
import {
  getHourBlockWithClientById,
  listHourBlockClientDirectory,
  listHourBlockInvoiceDirectory,
} from '@/lib/queries/hour-blocks'
import {
  getInvoiceById,
  listInvoiceReferenceData,
} from '@/lib/queries/invoices'
import { getProjectById } from '@/lib/queries/projects'
import { buildAssignmentsForUsers, getUserById } from '@/lib/queries/users'
import type { ProjectWithClient } from '@/lib/settings/projects/project-sheet-form'
import type { DbClient, DbUser } from '@/lib/types'

import { NEW_SHEET_VALUE } from '../entities'
import type { SheetInitEntity, SheetInitPayloads } from './payloads'

type SheetInitResolver<E extends SheetInitEntity> = (
  user: AppUser,
  /** Param value: a validated UUID, or `new` for create sheets. */
  id: string
) => Promise<SheetInitPayloads[E]>

const resolveClientInit: SheetInitResolver<'client'> = async (_user, id) => {
  if (id === NEW_SHEET_VALUE) {
    return { client: null }
  }

  // The client sheet self-fetches its reference data (contacts/admins) —
  // it only needs the row, in the snake_case `DbClient` shape it consumes.
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new NotFoundError('Client not found')
  }

  const client: DbClient = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    website: row.website,
    state: row.state ?? null,
    origination_contact_id: row.originationContactId,
    origination_user_id: row.originationUserId,
    closer_user_id: row.closerUserId,
    billing_type: row.billingType,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }

  return { client }
}

const resolveSubmissionInit: SheetInitResolver<'submission'> = async (
  user,
  id
) => {
  if (id === NEW_SHEET_VALUE) {
    throw new NotFoundError('Submissions cannot be created from the portal')
  }

  const submission = await fetchFormSubmissionById(user, id, true)
  return { submission }
}

const resolveContactInit: SheetInitResolver<'contact'> = async (user, id) => {
  if (id === NEW_SHEET_VALUE) {
    return { contact: null }
  }

  // The contact sheet self-fetches its client links (`getContactSheetData`)
  // — it only needs the minimal row.
  const contact = await getContactSheetInputById(user, id)
  return { contact }
}

const resolveHourBlockInit: SheetInitResolver<'hour-block'> = async (
  user,
  id
) => {
  const [clientDirectory, invoiceDirectory] = await Promise.all([
    listHourBlockClientDirectory(user),
    listHourBlockInvoiceDirectory(user),
  ])

  if (id === NEW_SHEET_VALUE) {
    return { hourBlock: null, clients: clientDirectory, invoices: invoiceDirectory }
  }

  const hourBlock = await getHourBlockWithClientById(user, id)
  if (!hourBlock) {
    throw new NotFoundError('Hour block not found')
  }

  return { hourBlock, clients: clientDirectory, invoices: invoiceDirectory }
}

const resolveInvoiceInit: SheetInitResolver<'invoice'> = async (user, id) => {
  const reference = await listInvoiceReferenceData(user)

  if (id === NEW_SHEET_VALUE) {
    return { invoice: null, ...reference }
  }

  const invoice = await getInvoiceById(user, id)
  if (!invoice) {
    throw new NotFoundError('Invoice not found')
  }

  return { invoice, ...reference }
}

const resolveUserInit: SheetInitResolver<'user'> = async (user, id) => {
  if (id === NEW_SHEET_VALUE) {
    return { user: null, currentUserId: user.id, assignments: {} }
  }

  const [row, assignments] = await Promise.all([
    getUserById(user, id),
    buildAssignmentsForUsers([id]),
  ])

  // Same camelCase → `DbUser` mapping the users settings page applies.
  const record: DbUser = {
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    avatar_url: row.avatarUrl,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    disabled_at: row.disabledAt,
  }

  return { user: record, currentUserId: user.id, assignments }
}

const resolveProjectInit: SheetInitResolver<'project'> = async (user, id) => {
  const [clientDirectory, adminUsersResult] = await Promise.all([
    fetchClientDirectory(),
    fetchAdminUsers(),
  ])

  const clientRows = clientDirectory.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))
  const adminUsers = adminUsersResult.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
    disabled_at: admin.disabled_at ?? null,
  }))

  if (id === NEW_SHEET_VALUE) {
    return { project: null, clients: clientRows, adminUsers }
  }

  const row = await getProjectById(user, id)
  // The directory holds every client (archived included), so the project's
  // client sub-row resolves from it without another query.
  const clientRow = row.clientId
    ? (clientDirectory.find(client => client.id === row.clientId) ?? null)
    : null

  const project: ProjectWithClient = {
    id: row.id,
    client_id: row.clientId,
    name: row.name,
    status: row.status,
    type: row.type,
    starts_on: row.startsOn,
    ends_on: row.endsOn,
    created_by: row.createdBy,
    owner_id: row.ownerId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    slug: row.slug,
    client: clientRow
      ? {
          id: clientRow.id,
          name: clientRow.name,
          deleted_at: clientRow.deletedAt,
        }
      : null,
  }

  return { project, clients: clientRows, adminUsers }
}

const resolveLeadInit: SheetInitResolver<'lead'> = async (user, id) => {
  const assignees = await fetchLeadAssignees()
  const senderName = user.full_name ?? user.email ?? null

  if (id === NEW_SHEET_VALUE) {
    return { lead: null, assignees, senderName }
  }

  const lead = await fetchLeadById(user, id)
  return { lead, assignees, senderName }
}

const resolveTaskInit: SheetInitResolver<'task'> = async (user, id) => {
  // The sheet only reads project identity fields for its selector — no need
  // to hydrate every project's task graph.
  const [admins, allProjects, salesProjectId] = await Promise.all([
    fetchAdminUsers(),
    fetchProjectsLite(),
    getOrCreateSalesProject(user.id),
  ])

  const base = {
    admins,
    projects: allProjects,
    salesProjectId,
    currentUserId: user.id,
  }

  if (id === NEW_SHEET_VALUE) {
    return { task: null, ...base }
  }

  // Resolve the task's project, then hydrate just that project's graph so
  // the sheet gets a full `TaskWithRelations`.
  const holdingProjectId = await getActiveTaskProjectId(id)
  if (!holdingProjectId) {
    throw new NotFoundError('Task not found')
  }

  const [hydratedProject] = await fetchProjectsWithRelationsByIds([
    holdingProjectId,
  ])
  const task = hydratedProject?.tasks.find(item => item.id === id) ?? null

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  return {
    task,
    ...base,
    projects: allProjects.map(project =>
      project.id === holdingProjectId && hydratedProject
        ? hydratedProject
        : project
    ),
  }
}

const RESOLVERS: {
  [E in SheetInitEntity]: SheetInitResolver<E>
} = {
  task: resolveTaskInit,
  client: resolveClientInit,
  submission: resolveSubmissionInit,
  contact: resolveContactInit,
  'hour-block': resolveHourBlockInit,
  invoice: resolveInvoiceInit,
  user: resolveUserInit,
  project: resolveProjectInit,
  lead: resolveLeadInit,
}

export const isSheetInitEntity = (value: string): value is SheetInitEntity =>
  value in RESOLVERS

export async function resolveSheetInit<E extends SheetInitEntity>(
  user: AppUser,
  entity: E,
  id: string
): Promise<SheetInitPayloads[E]> {
  return RESOLVERS[entity](user, id)
}

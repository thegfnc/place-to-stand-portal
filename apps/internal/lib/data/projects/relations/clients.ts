import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients as clientsTable,
  clientMembers as clientMembersTable,
  users as usersTable,
} from '@/lib/db/schema'
import type { DbClient, DbUser } from '@/lib/types'

import type { MemberWithUser } from '../types'

export type ClientRow = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  state: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
  billingType: DbClient['billing_type']
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type MemberRow = {
  membership: {
    id: number
    clientId: string
    userId: string
    createdAt: string
    deletedAt: string | null
  }
  user: {
    id: string
    email: string
    fullName: string | null
    role: DbUser['role']
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    disabledAt: string | null
  } | null
}

export async function loadClientRows(clientIds: string[]): Promise<ClientRow[]> {
  if (!clientIds.length) {
    return []
  }

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      slug: clientsTable.slug,
      notes: clientsTable.notes,
      website: clientsTable.website,
      state: clientsTable.state,
      originationContactId: clientsTable.originationContactId,
      originationUserId: clientsTable.originationUserId,
      closerUserId: clientsTable.closerUserId,
      billingType: clientsTable.billingType,
      createdBy: clientsTable.createdBy,
      createdAt: clientsTable.createdAt,
      updatedAt: clientsTable.updatedAt,
      deletedAt: clientsTable.deletedAt,
    })
    .from(clientsTable)
    .where(and(inArray(clientsTable.id, clientIds), isNull(clientsTable.deletedAt)))
}

export async function loadMemberRows(clientIds: string[]): Promise<MemberRow[]> {
  if (!clientIds.length) {
    return []
  }

  return db
    .select({
      membership: {
        id: clientMembersTable.id,
        clientId: clientMembersTable.clientId,
        userId: clientMembersTable.userId,
        createdAt: clientMembersTable.createdAt,
        deletedAt: clientMembersTable.deletedAt,
      },
      user: {
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        deletedAt: usersTable.deletedAt,
        disabledAt: usersTable.disabledAt,
      },
    })
    .from(clientMembersTable)
    .leftJoin(usersTable, eq(clientMembersTable.userId, usersTable.id))
    .where(and(inArray(clientMembersTable.clientId, clientIds), isNull(clientMembersTable.deletedAt)))
}

export function mapClientRows(rows: ClientRow[]): DbClient[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    website: row.website,
    state: row.state,
    origination_contact_id: row.originationContactId,
    origination_user_id: row.originationUserId,
    closer_user_id: row.closerUserId,
    billing_type: row.billingType,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }))
}

export function mapMemberRows(rows: MemberRow[]): MemberWithUser[] {
  return rows.map(row => ({
    id: row.membership.id,
    client_id: row.membership.clientId,
    user_id: row.membership.userId,
    created_at: row.membership.createdAt,
    deleted_at: row.membership.deletedAt,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          full_name: row.user.fullName,
          role: row.user.role,
          avatar_url: row.user.avatarUrl,
          created_at: row.user.createdAt,
          updated_at: row.user.updatedAt,
          deleted_at: row.user.deletedAt,
          disabled_at: row.user.disabledAt,
        }
      : null,
  }))
}



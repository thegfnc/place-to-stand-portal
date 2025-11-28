import { sql } from "drizzle-orm"

import { clients } from "@/lib/db/schema"

export type SelectClient = typeof clients.$inferSelect

export const clientFields = {
  id: clients.id,
  name: clients.name,
  slug: clients.slug,
  notes: clients.notes,
  billingType: clients.billingType,
  createdBy: clients.createdBy,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
  deletedAt: clients.deletedAt,
}

export const clientGroupByColumns = [
  clients.id,
  clients.name,
  clients.slug,
  clients.notes,
  clients.billingType,
  clients.createdBy,
  clients.createdAt,
  clients.updatedAt,
  clients.deletedAt,
] as const

export type ClientMetricsRow = {
  totalProjects: number | string | null
  activeProjects: number | string | null
}

export const ACTIVE_STATUS = "active"

export const clientMetricsSelect = {
  totalProjects: sql<number>`count(${clients.id})`,
}


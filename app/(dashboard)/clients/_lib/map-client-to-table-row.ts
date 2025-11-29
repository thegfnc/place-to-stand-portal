import type { ClientsSettingsListItem } from '@/lib/queries/clients'
import type { DbClient } from '@/lib/types'

export type ClientsTableRow = DbClient & {
  metrics: {
    active_projects: number
    total_projects: number
  }
}

export function mapClientToTableRow(client: ClientsSettingsListItem): ClientsTableRow {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    billing_type: client.billingType,
    created_by: client.createdBy,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    metrics: {
      active_projects: client.metrics.activeProjects,
      total_projects: client.metrics.totalProjects,
    },
  }
}

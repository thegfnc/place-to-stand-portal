import type { ProjectsSettingsListItem } from '@/lib/queries/projects'
import type { ProjectWithClient } from '@/lib/settings/projects/project-sheet-form'

export function mapProjectToTableRow(
  project: ProjectsSettingsListItem
): ProjectWithClient {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    slug: project.slug,
    client_id: project.clientId,
    type: project.type,
    created_by: project.createdBy,
    starts_on: project.startsOn,
    ends_on: project.endsOn,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    deleted_at: project.deletedAt,
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
          deleted_at: project.client.deletedAt,
        }
      : null,
    owner: project.owner
      ? {
          id: project.owner.id,
          fullName: project.owner.fullName,
          email: project.owner.email,
        }
      : null,
  }
}

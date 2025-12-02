import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import type { ProjectWithRelations } from '@/lib/types'

const PROJECT_GROUP_LABELS = {
  client: 'Client Projects',
  internal: 'Internal Projects',
  personal: 'Personal Projects',
} as const

type ProjectGroupKey = keyof typeof PROJECT_GROUP_LABELS

const PROJECT_GROUP_ORDER: ReadonlyArray<ProjectGroupKey> = [
  'client',
  'internal',
  'personal',
]

type BuildProjectSelectionOptionsArgs = {
  projects: ProjectWithRelations[]
  currentUserId?: string
}

export type ProjectSelectionOptions = {
  items: SearchableComboboxItem[]
  groups: SearchableComboboxGroup[]
}

const resolveGroupKey = (project: ProjectWithRelations): ProjectGroupKey => {
  if (project.type === 'INTERNAL') {
    return 'internal'
  }

  if (project.type === 'PERSONAL') {
    return 'personal'
  }

  return 'client'
}

const formatProjectLabel = (project: ProjectWithRelations) => {
  if (project.type === 'INTERNAL') {
    return `Internal / ${project.name}`
  }

  if (project.type === 'PERSONAL') {
    return `Personal / ${project.name}`
  }

  const clientName = project.client?.name ?? 'Unassigned'
  return `${clientName} / ${project.name}`
}

const filterProjectsForSelection = (
  projects: ProjectWithRelations[],
  currentUserId?: string
) => {
  if (!currentUserId) {
    return projects
  }

  return projects.filter(project => {
    if (project.type !== 'PERSONAL') {
      return true
    }

    return project.created_by !== null && project.created_by === currentUserId
  })
}

export const buildProjectSelectionOptions = ({
  projects,
  currentUserId,
}: BuildProjectSelectionOptionsArgs): ProjectSelectionOptions => {
  const groupedItems: Record<ProjectGroupKey, SearchableComboboxItem[]> = {
    client: [],
    internal: [],
    personal: [],
  }

  filterProjectsForSelection(projects, currentUserId)
    .filter(project => !project.deleted_at)
    .forEach(project => {
      const key = resolveGroupKey(project)
      const clientName = project.client?.name ?? null
      const description = clientName && key !== 'client' ? clientName : null

      groupedItems[key].push({
        value: project.id,
        label: formatProjectLabel(project),
        description: description ?? undefined,
        keywords: [project.name, clientName, project.type].filter(
          (keyword): keyword is string => Boolean(keyword)
        ),
      })
    })

  const maybeGroups: Array<SearchableComboboxGroup | null> =
    PROJECT_GROUP_ORDER.map(groupKey => {
      const items = groupedItems[groupKey].sort((a, b) =>
        a.label.localeCompare(b.label)
      )

      return items.length > 0
        ? {
            label: PROJECT_GROUP_LABELS[groupKey],
            items,
          }
        : null
    })

  const groups = maybeGroups.filter((group): group is SearchableComboboxGroup =>
    Boolean(group)
  )

  const items = groups.length > 0 ? groups.flatMap(group => group.items) : []

  return { items, groups }
}

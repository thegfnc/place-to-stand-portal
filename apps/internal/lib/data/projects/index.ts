import 'server-only'

import { cache } from 'react'
import { and, count, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureProjectAccess } from '@/lib/auth/permissions'
import type { ProjectStatusValue } from '@/lib/constants'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { ProjectWithRelations } from '@/lib/types'

import { getClientHoursTotals } from '@pts/db/hours'
import { getTimeLogSummariesForProjects } from '@/lib/queries/time-logs'
import { assembleProjectsWithRelations } from './assemble-projects'
import { fetchBaseProjects } from './fetch-base-projects'
import { fetchProjectRelations, loadOwners } from './fetch-project-relations'
import { getReposForProjects } from '@/lib/data/github-repos'
import { getIntegrationLinksForProjects } from '@/lib/data/project-integration-links'
import { toIntegrationLinkSummary } from '@/lib/types/integrations'
import { loadClientRows, mapClientRows } from './relations/clients'
export { fetchProjectCalendarTasks } from './fetch-project-calendar-tasks'

// ============================================================
// TYPES
// ============================================================

export type ProjectDetail = {
  id: string
  name: string
  slug: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  status: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  clientId: string | null
  startsOn: string | null
  endsOn: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type FetchProjectsWithRelationsOptions = {
  forUserId?: string
  /**
   * Status predicate. Undefined = no status filtering; an empty array means
   * an explicitly cleared selection and matches nothing.
   */
  statuses?: ProjectStatusValue[]
  /** ILIKE search over project name/slug and client name. */
  search?: string
  /**
   * Hydrate archived tasks (unbounded, monotonically growing set). Only the
   * review and archive tabs render them; default false skips the query.
   */
  includeArchivedTasks?: boolean
}
/**
 * All non-deleted projects with clients hydrated but NO task/member/repo
 * relations — for project switchers and sheet selectors, which only read
 * identity fields. Shapes as ProjectWithRelations (empty relation arrays)
 * so existing consumers type-check; pair with
 * `fetchProjectsWithRelationsByIds` to hydrate the active project(s).
 */
export const fetchProjectsLite = cache(
  async (): Promise<ProjectWithRelations[]> => {
    const baseProjects = await fetchBaseProjects({})
    const clients = await loadClientRows(baseProjects.clientIds)

    return assembleProjectsWithRelations({
      projects: baseProjects.projects,
      projectClientLookup: baseProjects.projectClientLookup,
      relations: {
        clients: mapClientRows(clients),
        owners: [],
        members: [],
        tasks: [],
        archivedTasks: [],
        githubReposByProject: new Map(),
        integrationLinksByProject: new Map(),
      },
      timeLogSummaries: new Map(),
      // Switchers/selectors read identity fields only; burndown is unused.
      clientHours: new Map(),
    })
  }
)

type LandingTaskProgress = { done: number; total: number }

export type LandingProject = ProjectWithRelations & {
  taskProgress: LandingTaskProgress
}

/**
 * Landing table needs progress numbers, owner, client, and first repo per
 * project — never the task rows themselves. One grouped aggregate replaces
 * hydrating every task (with description, counts, assignees) per request.
 */
export async function fetchProjectsForLanding(
  options: Pick<FetchProjectsWithRelationsOptions, 'statuses' | 'search'> = {}
): Promise<LandingProject[]> {
  const baseProjects = await fetchBaseProjects({
    statuses: options.statuses,
    search: options.search,
  })

  const [clients, owners, reposMap, integrationLinksMap, progressRows] =
    await Promise.all([
    loadClientRows(baseProjects.clientIds),
    loadOwners(baseProjects.ownerIds),
    getReposForProjects(baseProjects.projectIds),
    getIntegrationLinksForProjects(baseProjects.projectIds),
    baseProjects.projectIds.length
      ? db
          .select({
            projectId: tasks.projectId,
            total: sql<number>`count(*)`,
            done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')`,
          })
          .from(tasks)
          .where(
            and(
              inArray(tasks.projectId, baseProjects.projectIds),
              isNull(tasks.deletedAt)
            )
          )
          .groupBy(tasks.projectId)
      : Promise.resolve([]),
  ])

  const githubReposByProject = new Map(
    Array.from(reposMap.entries(), ([projectId, repos]) => [
      projectId,
      repos.map(repo => ({
        id: repo.id,
        repoFullName: repo.repoFullName,
        defaultBranch: repo.defaultBranch,
      })),
    ])
  )

  const integrationLinksByProject = new Map(
    Array.from(integrationLinksMap.entries(), ([projectId, links]) => [
      projectId,
      links.map(toIntegrationLinkSummary),
    ])
  )

  const progressByProject = new Map(
    progressRows.map(row => [
      row.projectId,
      { done: Number(row.done), total: Number(row.total) },
    ])
  )

  const assembled = assembleProjectsWithRelations({
    projects: baseProjects.projects,
    projectClientLookup: baseProjects.projectClientLookup,
    relations: {
      clients: mapClientRows(clients),
      owners,
      members: [],
      tasks: [],
      archivedTasks: [],
      githubReposByProject,
      integrationLinksByProject,
    },
    timeLogSummaries: new Map(),
    // The landing page reads client hours from `fetchClientsWithMetrics`, not
    // from `project.burndown`.
    clientHours: new Map(),
  })

  return assembled.map(project => ({
    ...project,
    taskProgress: progressByProject.get(project.id) ?? { done: 0, total: 0 },
  }))
}

export async function fetchProjectsWithRelationsByIds(
  projectIds: string[],
  options: { includeArchivedTasks?: boolean } = {}
): Promise<ProjectWithRelations[]> {
  if (!projectIds.length) {
    return []
  }

  const baseProjects = await fetchBaseProjects({ projectIds })
  const relations = await fetchProjectRelations({
    projectIds: baseProjects.projectIds,
    clientIds: baseProjects.clientIds,
    ownerIds: baseProjects.ownerIds,
    includeArchivedTasks: options.includeArchivedTasks,
  })

  // Client hours must be queried per CLIENT, not derived from the hydrated
  // projects — these routes hydrate a single project, so deriving the client
  // burndown from `timeLogSummaries` would ignore the client's other projects.
  const [timeLogSummaries, clientHours] = await Promise.all([
    getTimeLogSummariesForProjects(baseProjects.projectIds),
    getClientHoursTotals(db, baseProjects.clientIds),
  ])

  return assembleProjectsWithRelations({
    projects: baseProjects.projects,
    projectClientLookup: baseProjects.projectClientLookup,
    relations,
    timeLogSummaries,
    clientHours,
  })
}

// ============================================================
// LANDING COUNTS
// ============================================================

export type LandingProjectCounts = {
  /** All projects visible to this user, pre-filter. */
  total: number
  clientCount: number
  internalCount: number
  personalCount: number
}

/**
 * Unfiltered per-type counts for the projects landing (PRD 004 §03):
 * powers the `total` in `Showing N of M` and the per-section
 * "match the current filters" empty-state wording. PERSONAL projects only
 * count for their creator, mirroring the landing's visibility rules.
 */
export const fetchLandingProjectCounts = cache(
  async (currentUserId: string): Promise<LandingProjectCounts> => {
    const rows = await db
      .select({ type: projects.type, count: count() })
      .from(projects)
      .where(
        and(
          isNull(projects.deletedAt),
          or(
            ne(projects.type, 'PERSONAL'),
            eq(projects.createdBy, currentUserId)
          )
        )
      )
      .groupBy(projects.type)

    const byType = new Map(rows.map(row => [row.type, row.count]))
    const clientCount = byType.get('CLIENT') ?? 0
    const internalCount = byType.get('INTERNAL') ?? 0
    const personalCount = byType.get('PERSONAL') ?? 0

    return {
      total: clientCount + internalCount + personalCount,
      clientCount,
      internalCount,
      personalCount,
    }
  }
)

// ============================================================
// SIMPLE PROJECT LOOKUPS
// ============================================================

/**
 * Fetch a project by ID
 */
const fetchProjectById = cache(
  async (user: AppUser, projectId: string): Promise<ProjectDetail> => {
    await ensureProjectAccess(user, projectId)

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        type: projects.type,
        status: projects.status,
        clientId: projects.clientId,
        startsOn: projects.startsOn,
        endsOn: projects.endsOn,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!rows.length) {
      throw new NotFoundError('Project not found')
    }

    return rows[0]
  }
)

/**
 * Fetch a project by slug
 */
const fetchProjectBySlug = cache(
  async (user: AppUser, slug: string): Promise<ProjectDetail> => {
    const projectRow = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
      .limit(1)

    if (!projectRow.length) {
      throw new NotFoundError('Project not found')
    }

    // Then fetch full details with permission check
    return fetchProjectById(user, projectRow[0].id)
  }
)

/**
 * Resolves a project identifier (slug or UUID) to the project record.
 * Returns the project detail if found, throws NotFoundError otherwise.
 */
export const resolveProjectIdentifier = cache(
  async (
    user: AppUser,
    identifier: string
  ): Promise<ProjectDetail & { resolvedId: string }> => {
    // Check if identifier looks like a UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      )

    let project: ProjectDetail

    if (isUUID) {
      project = await fetchProjectById(user, identifier)
    } else {
      project = await fetchProjectBySlug(user, identifier)
    }

    return { ...project, resolvedId: project.id }
  }
)

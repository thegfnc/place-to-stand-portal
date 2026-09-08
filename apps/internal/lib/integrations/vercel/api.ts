import 'server-only'

/**
 * Thin client for the Vercel REST API, authenticated with a staff member's
 * personal access token. Personal tokens reach every team the member
 * belongs to — including client-owned teams that invited them — by passing
 * `teamId` per request, which is why we use them instead of a per-team
 * Integration install.
 */

const VERCEL_API = 'https://api.vercel.com'

export class VercelApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'VercelApiError'
  }
}

export type VercelUser = {
  id: string
  username: string
  email: string | null
  name: string | null
}

export type VercelTeam = {
  id: string
  slug: string
  name: string
}

export type VercelProject = {
  id: string
  name: string
  framework: string | null
  /** Null for projects under the member's personal scope. */
  teamId: string | null
  teamSlug: string | null
  teamName: string | null
  /** Git repo the project deploys from, if any (e.g. "owner/repo"). */
  repoFullName: string | null
  /** Primary production domain, when Vercel reports one. */
  productionDomain: string | null
}

async function vercelFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${VERCEL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Vercel API responded ${response.status}`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      if (body.error?.message) {
        message = body.error.message
      }
    } catch {
      // Body wasn't JSON; keep the status message.
    }
    throw new VercelApiError(message, response.status)
  }

  return (await response.json()) as T
}

export async function fetchVercelUser(token: string): Promise<VercelUser> {
  const { user } = await vercelFetch<{
    user: {
      id: string
      username: string
      email?: string | null
      name?: string | null
    }
  }>(token, '/v2/user')

  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    name: user.name ?? null,
  }
}

export async function fetchVercelTeams(token: string): Promise<VercelTeam[]> {
  const teams: VercelTeam[] = []
  let until: number | undefined

  // `/v2/teams` pages with timestamps rather than continuation tokens.
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: '100' })
    if (until) {
      query.set('until', String(until))
    }

    const data = await vercelFetch<{
      teams: Array<{ id: string; slug: string; name: string | null }>
      pagination?: { next?: number | null }
    }>(token, `/v2/teams?${query.toString()}`)

    teams.push(
      ...data.teams.map(team => ({
        id: team.id,
        slug: team.slug,
        name: team.name ?? team.slug,
      }))
    )

    if (!data.pagination?.next || data.teams.length === 0) {
      break
    }
    until = data.pagination.next
  }

  return teams
}

type RawVercelProject = {
  id: string
  name: string
  framework?: string | null
  link?: { type?: string; org?: string; repo?: string } | null
  targets?: {
    production?: { alias?: string[] | null } | null
  } | null
}

const toRepoFullName = (link: RawVercelProject['link']) =>
  link?.org && link?.repo ? `${link.org}/${link.repo}` : null

/**
 * Lists the projects visible in one scope: a team when `team` is given,
 * otherwise the member's personal account.
 */
export async function fetchVercelProjects(
  token: string,
  team: VercelTeam | null
): Promise<VercelProject[]> {
  const projects: VercelProject[] = []
  let from: string | undefined

  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({ limit: '100' })
    if (team) {
      query.set('teamId', team.id)
    }
    if (from) {
      query.set('from', from)
    }

    const data = await vercelFetch<{
      projects: RawVercelProject[]
      pagination?: { next?: string | number | null }
    }>(token, `/v10/projects?${query.toString()}`)

    projects.push(
      ...data.projects.map(project => ({
        id: project.id,
        name: project.name,
        framework: project.framework ?? null,
        teamId: team?.id ?? null,
        teamSlug: team?.slug ?? null,
        teamName: team?.name ?? null,
        repoFullName: toRepoFullName(project.link),
        productionDomain: project.targets?.production?.alias?.[0] ?? null,
      }))
    )

    if (!data.pagination?.next || data.projects.length === 0) {
      break
    }
    from = String(data.pagination.next)
  }

  return projects
}

/**
 * Every project the token can see, across the personal scope and every
 * team. Teams that reject the token (scoped tokens, revoked membership)
 * are skipped rather than failing the whole listing.
 */
export async function fetchAllVercelProjects(
  token: string
): Promise<VercelProject[]> {
  const teams = await fetchVercelTeams(token).catch((error: unknown) => {
    if (error instanceof VercelApiError && error.status === 403) {
      return [] as VercelTeam[]
    }
    throw error
  })

  const scopes: Array<VercelTeam | null> = [null, ...teams]
  const results = await Promise.all(
    scopes.map(scope =>
      fetchVercelProjects(token, scope).catch((error: unknown) => {
        if (error instanceof VercelApiError && error.status === 403) {
          return [] as VercelProject[]
        }
        throw error
      })
    )
  )

  return results.flat()
}

export function buildVercelProjectUrl(
  project: Pick<VercelProject, 'name' | 'teamSlug'>,
  username: string | null
): string {
  const owner = project.teamSlug ?? username
  return owner
    ? `https://vercel.com/${owner}/${project.name}`
    : `https://vercel.com`
}

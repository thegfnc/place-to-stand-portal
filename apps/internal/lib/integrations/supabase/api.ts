import 'server-only'

/**
 * Thin client for the Supabase Management API, authenticated with a staff
 * member's personal access token. A personal token reaches every
 * organization the member belongs to — including client-owned orgs that
 * invited them — so one connection covers agency- and client-hosted
 * projects alike.
 *
 * Not to be confused with `lib/supabase`, which is this app's own auth and
 * storage client.
 */

const SUPABASE_MANAGEMENT_API = 'https://api.supabase.com'

export class SupabaseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'SupabaseApiError'
  }
}

export type SupabaseProfile = {
  id: string
  primaryEmail: string | null
  firstName: string | null
  lastName: string | null
}

export type SupabaseOrganization = {
  id: string
  slug: string
  name: string
}

export type SupabaseProject = {
  id: string
  ref: string
  name: string
  organizationId: string
  organizationSlug: string | null
  organizationName: string | null
  region: string | null
  status: string | null
}

async function supabaseFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_MANAGEMENT_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Supabase API responded ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Body wasn't JSON; keep the status message.
    }
    throw new SupabaseApiError(message, response.status)
  }

  return (await response.json()) as T
}

export async function fetchSupabaseProfile(
  token: string
): Promise<SupabaseProfile> {
  const profile = await supabaseFetch<{
    id: string
    primary_email?: string | null
    first_name?: string | null
    last_name?: string | null
  }>(token, '/v1/profile')

  return {
    id: profile.id,
    primaryEmail: profile.primary_email ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
  }
}

export async function fetchSupabaseOrganizations(
  token: string
): Promise<SupabaseOrganization[]> {
  const organizations = await supabaseFetch<
    Array<{ id: string; slug: string; name: string }>
  >(token, '/v1/organizations')

  return organizations.map(org => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
  }))
}

/**
 * Every project the token can see, annotated with its organization so the
 * picker can group and label them.
 */
export async function fetchAllSupabaseProjects(
  token: string
): Promise<SupabaseProject[]> {
  const [organizations, projects] = await Promise.all([
    fetchSupabaseOrganizations(token),
    supabaseFetch<
      Array<{
        id: string
        ref: string
        name: string
        organization_id: string
        region?: string | null
        status?: string | null
      }>
    >(token, '/v1/projects'),
  ])

  const orgsById = new Map(organizations.map(org => [org.id, org]))

  return projects.map(project => {
    const org = orgsById.get(project.organization_id) ?? null
    return {
      id: project.id,
      ref: project.ref,
      name: project.name,
      organizationId: project.organization_id,
      organizationSlug: org?.slug ?? null,
      organizationName: org?.name ?? null,
      region: project.region ?? null,
      status: project.status ?? null,
    }
  })
}

export function buildSupabaseProjectUrl(ref: string): string {
  return `https://supabase.com/dashboard/project/${ref}`
}

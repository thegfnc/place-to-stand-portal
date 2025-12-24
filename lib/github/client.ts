import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'

const GITHUB_API_BASE = 'https://api.github.com'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  default_branch: string
  private: boolean
  description: string | null
  html_url: string
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

/**
 * Get GitHub access token for a specific connection
 */
async function getGitHubToken(
  userId: string,
  connectionId?: string
): Promise<{ token: string; connectionId: string }> {
  const conditions = [
    eq(oauthConnections.userId, userId),
    eq(oauthConnections.provider, 'GITHUB'),
    eq(oauthConnections.status, 'ACTIVE'),
    isNull(oauthConnections.deletedAt),
  ]

  // If specific connection requested, add that filter
  if (connectionId) {
    conditions.push(eq(oauthConnections.id, connectionId))
  }

  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(and(...conditions))
    .limit(1)

  if (!connection) {
    throw new Error('No active GitHub connection')
  }

  return {
    token: decryptToken(connection.accessToken),
    connectionId: connection.id,
  }
}

/**
 * Make authenticated GitHub API request
 */
async function githubFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
  connectionId?: string
): Promise<T> {
  const { token } = await getGitHubToken(userId, connectionId)

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * List repositories user has access to
 */
export async function listUserRepos(
  userId: string,
  options: { page?: number; perPage?: number; connectionId?: string } = {}
): Promise<GitHubRepo[]> {
  const { page = 1, perPage = 100, connectionId } = options

  return githubFetch(
    userId,
    `/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
    {},
    connectionId
  )
}

/**
 * Get single repository details
 */
export async function getRepo(
  userId: string,
  owner: string,
  repo: string,
  connectionId?: string
): Promise<GitHubRepo> {
  return githubFetch(userId, `/repos/${owner}/${repo}`, {}, connectionId)
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  userId: string,
  owner: string,
  repo: string,
  params: {
    title: string
    body: string
    head: string
    base: string
    draft?: boolean
  },
  connectionId?: string
): Promise<{ number: number; html_url: string }> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    connectionId
  )
}

/**
 * Get repository branches
 */
export async function listBranches(
  userId: string,
  owner: string,
  repo: string,
  connectionId?: string
): Promise<GitHubBranch[]> {
  return githubFetch(userId, `/repos/${owner}/${repo}/branches`, {}, connectionId)
}

/**
 * Get a specific branch (to get its SHA)
 */
export async function getBranch(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  connectionId?: string
): Promise<GitHubBranch> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    {},
    connectionId
  )
}

/**
 * Create a new branch from a base branch
 */
export async function createBranch(
  userId: string,
  owner: string,
  repo: string,
  params: {
    newBranch: string
    baseBranch: string
  },
  connectionId?: string
): Promise<{ ref: string; sha: string }> {
  // First, get the SHA of the base branch
  const baseBranchInfo = await getBranch(userId, owner, repo, params.baseBranch, connectionId)
  const sha = baseBranchInfo.commit.sha

  // Create the new branch reference
  const result = await githubFetch<{ ref: string; object: { sha: string } }>(
    userId,
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${params.newBranch}`,
        sha,
      }),
    },
    connectionId
  )

  return { ref: result.ref, sha: result.object.sha }
}

/**
 * Check if a branch exists
 */
export async function branchExists(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  connectionId?: string
): Promise<boolean> {
  try {
    await getBranch(userId, owner, repo, branch, connectionId)
    return true
  } catch {
    return false
  }
}

/**
 * Get the default connection ID for a user
 */
export async function getDefaultConnectionId(userId: string): Promise<string | null> {
  const [connection] = await db
    .select({ id: oauthConnections.id })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GITHUB'),
        eq(oauthConnections.status, 'ACTIVE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  return connection?.id ?? null
}

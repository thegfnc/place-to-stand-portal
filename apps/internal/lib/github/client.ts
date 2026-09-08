import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'

export { resolveRepoLinkAuth } from './resolve-auth'

/**
 * Union type for GitHub authentication.
 *
 * - `string`           — OAuth connection ID (legacy callers)
 * - `{ token: string }` — Pre-resolved bearer token (from resolveRepoLinkAuth)
 * - `undefined`         — Use default OAuth connection for the user
 */
export type GitHubAuth = string | { token: string } | undefined

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
  auth?: GitHubAuth
): Promise<T> {
  const token =
    typeof auth === 'object' && auth !== null
      ? auth.token
      : (await getGitHubToken(userId, auth)).token

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
  auth?: GitHubAuth
): Promise<GitHubRepo> {
  return githubFetch(userId, `/repos/${owner}/${repo}`, {}, auth)
}

/**
 * Get repository branches
 */
export async function listBranches(
  userId: string,
  owner: string,
  repo: string,
  auth?: GitHubAuth
): Promise<GitHubBranch[]> {
  return githubFetch(userId, `/repos/${owner}/${repo}/branches`, {}, auth)
}

// ---------------------------------------------------------------------------
// Issue & Comment helpers (for pts-worker integration)
// ---------------------------------------------------------------------------

interface GitHubIssue {
  number: number
  html_url: string
}

interface GitHubCommentResult {
  id: number
  html_url: string
}

export interface GitHubComment {
  id: number
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
  html_url: string
}

/**
 * Create a GitHub issue
 */
export async function createIssue(
  userId: string,
  owner: string,
  repo: string,
  params: { title: string; body: string; labels?: string[] },
  auth?: GitHubAuth
): Promise<GitHubIssue> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    auth
  )
}

/**
 * Create a comment on a GitHub issue
 */
export async function createIssueComment(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  auth?: GitHubAuth
): Promise<GitHubCommentResult> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
    auth
  )
}

/**
 * List comments on a GitHub issue
 */
export async function listIssueComments(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  auth?: GitHubAuth
): Promise<GitHubComment[]> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    {},
    auth
  )
}

/**
 * Add a reaction to an issue comment
 */
export async function createCommentReaction(
  userId: string,
  owner: string,
  repo: string,
  commentId: number,
  content: string,
  auth?: GitHubAuth
): Promise<{ id: number }> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
    auth
  )
}

// ---------------------------------------------------------------------------
// File / Tree / Search helpers (for AI planning tool use)
// ---------------------------------------------------------------------------

interface GitHubFileContent {
  type: 'file'
  name: string
  path: string
  content: string // base64
  encoding: string
  size: number
  sha: string
}

interface GitHubDirEntry {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  name: string
  path: string
  size: number
  sha: string
}

interface GitHubTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

interface GitHubTreeResponse {
  sha: string
  tree: GitHubTreeEntry[]
  truncated: boolean
}

interface GitHubSearchCodeResult {
  total_count: number
  items: Array<{
    name: string
    path: string
    sha: string
    html_url: string
    repository: { full_name: string }
    text_matches?: Array<{
      fragment: string
      matches: Array<{ text: string; indices: number[] }>
    }>
  }>
}

/**
 * Get file contents or directory listing from a GitHub repo.
 * For files: returns decoded UTF-8 content.
 * For directories: returns array of entries.
 */
export async function getFileContents(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  auth?: GitHubAuth
): Promise<
  | { type: 'file'; content: string; path: string; size: number; sha: string }
  | { type: 'dir'; entries: Array<{ type: string; name: string; path: string; size: number }> }
> {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const result = await githubFetch<GitHubFileContent | GitHubDirEntry[]>(
    userId,
    `/repos/${owner}/${repo}/contents/${encodedPath}${params}`,
    {},
    auth
  )

  // Directory response is an array
  if (Array.isArray(result)) {
    return {
      type: 'dir',
      entries: result.map(e => ({
        type: e.type,
        name: e.name,
        path: e.path,
        size: e.size,
      })),
    }
  }

  // File response — decode base64 content
  const content = Buffer.from(result.content, 'base64').toString('utf-8')
  return {
    type: 'file',
    content,
    path: result.path,
    size: result.size,
    sha: result.sha,
  }
}

/**
 * Get the full repository tree (recursive).
 * Returns a flat list of paths with types.
 */
export async function getRepoTree(
  userId: string,
  owner: string,
  repo: string,
  ref = 'HEAD',
  auth?: GitHubAuth
): Promise<{ entries: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>; truncated: boolean }> {
  const result = await githubFetch<GitHubTreeResponse>(
    userId,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    {},
    auth
  )

  return {
    entries: result.tree.map(e => ({
      path: e.path,
      type: e.type,
      size: e.size,
    })),
    truncated: result.truncated,
  }
}

/**
 * Search code in a specific repository.
 * Uses the GitHub Code Search API with text-match fragments.
 */
export async function searchRepoCode(
  userId: string,
  owner: string,
  repo: string,
  query: string,
  auth?: GitHubAuth
): Promise<Array<{ name: string; path: string; fragments: string[] }>> {
  const q = encodeURIComponent(`${query} repo:${owner}/${repo}`)
  const result = await githubFetch<GitHubSearchCodeResult>(
    userId,
    `/search/code?q=${q}`,
    {
      headers: {
        Accept: 'application/vnd.github.text-match+json',
      },
    },
    auth
  )

  return result.items.map(item => ({
    name: item.name,
    path: item.path,
    fragments: item.text_matches?.map(m => m.fragment) ?? [],
  }))
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

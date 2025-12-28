import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { githubRepoLinks } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import type { GitHubRepoLink } from '@/lib/types/github'

/**
 * Get repos linked to a project
 */
export async function getProjectRepos(projectId: string): Promise<GitHubRepoLink[]> {
  return db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        eq(githubRepoLinks.projectId, projectId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
}

/**
 * Link a repository to a project
 */
export async function linkRepoToProject(
  projectId: string,
  repo: {
    oauthConnectionId: string
    repoOwner: string
    repoName: string
    repoFullName: string
    repoId: number
    defaultBranch: string
  },
  userId: string
): Promise<GitHubRepoLink> {
  const [link] = await db
    .insert(githubRepoLinks)
    .values({
      projectId,
      oauthConnectionId: repo.oauthConnectionId,
      repoOwner: repo.repoOwner,
      repoName: repo.repoName,
      repoFullName: repo.repoFullName,
      repoId: repo.repoId,
      defaultBranch: repo.defaultBranch,
      linkedBy: userId,
    })
    .returning()

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'GITHUB_REPO_LINKED',
    summary: `Linked repository ${repo.repoFullName} to project`,
    targetType: 'PROJECT',
    targetId: projectId,
    targetProjectId: projectId,
    metadata: { repoFullName: repo.repoFullName },
  })

  return link
}

/**
 * Unlink a repository from a project
 */
export async function unlinkRepo(linkId: string, userId: string): Promise<void> {
  const [link] = await db
    .select()
    .from(githubRepoLinks)
    .where(eq(githubRepoLinks.id, linkId))
    .limit(1)

  if (!link) throw new Error('Link not found')

  await db
    .update(githubRepoLinks)
    .set({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(githubRepoLinks.id, linkId))

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'GITHUB_REPO_UNLINKED',
    summary: `Unlinked repository ${link.repoFullName}`,
    targetType: 'PROJECT',
    targetId: link.projectId,
    targetProjectId: link.projectId,
    metadata: { repoFullName: link.repoFullName },
  })
}

/**
 * Get a single repo link by ID
 */
export async function getRepoLinkById(linkId: string): Promise<GitHubRepoLink | null> {
  const [link] = await db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        eq(githubRepoLinks.id, linkId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
    .limit(1)

  return link ?? null
}

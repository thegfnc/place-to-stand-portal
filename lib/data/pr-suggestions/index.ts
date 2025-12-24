import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prSuggestions, githubRepoLinks, emailMetadata } from '@/lib/db/schema'
import { createPullRequest, branchExists, createBranch } from '@/lib/github/client'
import { logActivity } from '@/lib/activity/logger'
import type { PRSuggestionWithContext } from '@/lib/types/github'

/**
 * Get pending PR suggestions (DRAFT or PENDING status)
 */
export async function getPendingPRSuggestions(
  options: { limit?: number } = {}
): Promise<PRSuggestionWithContext[]> {
  const { limit = 50 } = options

  const results = await db
    .select({
      suggestion: prSuggestions,
      repoFullName: githubRepoLinks.repoFullName,
      defaultBranch: githubRepoLinks.defaultBranch,
      emailSubject: emailMetadata.subject,
      emailFromEmail: emailMetadata.fromEmail,
    })
    .from(prSuggestions)
    .innerJoin(githubRepoLinks, eq(githubRepoLinks.id, prSuggestions.githubRepoLinkId))
    .leftJoin(emailMetadata, eq(emailMetadata.id, prSuggestions.emailMetadataId))
    .where(
      and(
        inArray(prSuggestions.status, ['DRAFT', 'PENDING']),
        isNull(prSuggestions.deletedAt)
      )
    )
    .orderBy(desc(prSuggestions.createdAt))
    .limit(limit)

  return results.map(r => ({
    ...r.suggestion,
    repoLink: {
      repoFullName: r.repoFullName,
      defaultBranch: r.defaultBranch,
    },
    email: r.emailSubject
      ? {
          subject: r.emailSubject,
          fromEmail: r.emailFromEmail!,
        }
      : null,
  }))
}

/**
 * Get single PR suggestion with context
 */
export async function getPRSuggestionById(
  suggestionId: string
): Promise<
  | (PRSuggestionWithContext & {
      repoOwner: string
      repoName: string
      oauthConnectionId: string
    })
  | null
> {
  const [result] = await db
    .select({
      suggestion: prSuggestions,
      repoFullName: githubRepoLinks.repoFullName,
      defaultBranch: githubRepoLinks.defaultBranch,
      repoOwner: githubRepoLinks.repoOwner,
      repoName: githubRepoLinks.repoName,
      oauthConnectionId: githubRepoLinks.oauthConnectionId,
      emailSubject: emailMetadata.subject,
      emailFromEmail: emailMetadata.fromEmail,
    })
    .from(prSuggestions)
    .innerJoin(githubRepoLinks, eq(githubRepoLinks.id, prSuggestions.githubRepoLinkId))
    .leftJoin(emailMetadata, eq(emailMetadata.id, prSuggestions.emailMetadataId))
    .where(
      and(eq(prSuggestions.id, suggestionId), isNull(prSuggestions.deletedAt))
    )
    .limit(1)

  if (!result) return null

  return {
    ...result.suggestion,
    repoLink: {
      repoFullName: result.repoFullName,
      defaultBranch: result.defaultBranch,
    },
    email: result.emailSubject
      ? {
          subject: result.emailSubject,
          fromEmail: result.emailFromEmail!,
        }
      : null,
    repoOwner: result.repoOwner,
    repoName: result.repoName,
    oauthConnectionId: result.oauthConnectionId,
  }
}

/**
 * Approve PR suggestion and create actual GitHub PR
 */
export async function approvePRSuggestion(
  suggestionId: string,
  userId: string,
  modifications?: {
    title?: string
    body?: string
    branch?: string
    baseBranch?: string
    createNewBranch?: boolean
  }
): Promise<{ prNumber: number; prUrl: string; branchCreated: boolean }> {
  // Get suggestion with repo info
  const suggestion = await getPRSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('PR suggestion not found')
  }

  if (!['DRAFT', 'PENDING'].includes(suggestion.status)) {
    throw new Error('PR suggestion already processed')
  }

  const finalTitle = modifications?.title ?? suggestion.suggestedTitle
  const finalBody = modifications?.body ?? suggestion.suggestedBody
  const finalBranch = modifications?.branch ?? suggestion.suggestedBranch
  const finalBaseBranch =
    modifications?.baseBranch ?? suggestion.suggestedBaseBranch ?? 'main'

  if (!finalBranch) {
    throw new Error('Branch name is required')
  }

  let branchCreated = false

  try {
    // Check if branch exists
    const exists = await branchExists(
      userId,
      suggestion.repoOwner,
      suggestion.repoName,
      finalBranch,
      suggestion.oauthConnectionId
    )

    // Create branch if it doesn't exist and user requested creation
    if (!exists) {
      if (modifications?.createNewBranch) {
        await createBranch(
          userId,
          suggestion.repoOwner,
          suggestion.repoName,
          {
            newBranch: finalBranch,
            baseBranch: finalBaseBranch,
          },
          suggestion.oauthConnectionId
        )
        branchCreated = true
      } else {
        throw new Error(
          `Branch "${finalBranch}" does not exist. Enable "Create new branch" to create it automatically.`
        )
      }
    }

    // Create PR on GitHub
    const pr = await createPullRequest(
      userId,
      suggestion.repoOwner,
      suggestion.repoName,
      {
        title: finalTitle,
        body: finalBody,
        head: finalBranch,
        base: finalBaseBranch,
      },
      suggestion.oauthConnectionId
    )

    // Update suggestion status
    await db
      .update(prSuggestions)
      .set({
        status: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        createdPrNumber: pr.number,
        createdPrUrl: pr.html_url,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prSuggestions.id, suggestionId))

    // Log activity
    await logActivity({
      actorId: userId,
      actorRole: 'ADMIN',
      verb: 'PR_CREATED_FROM_SUGGESTION',
      summary: `Created PR #${pr.number} on ${suggestion.repoLink.repoFullName}`,
      targetType: 'PROJECT',
      targetId: suggestionId,
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        repoFullName: suggestion.repoLink.repoFullName,
      },
    })

    return { prNumber: pr.number, prUrl: pr.html_url, branchCreated }
  } catch (error) {
    // Update suggestion with error
    await db
      .update(prSuggestions)
      .set({
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prSuggestions.id, suggestionId))

    throw error
  }
}

/**
 * Reject PR suggestion
 */
export async function rejectPRSuggestion(
  suggestionId: string,
  userId: string
): Promise<void> {
  const [suggestion] = await db
    .select({ repoLink: githubRepoLinks.repoFullName })
    .from(prSuggestions)
    .innerJoin(githubRepoLinks, eq(githubRepoLinks.id, prSuggestions.githubRepoLinkId))
    .where(eq(prSuggestions.id, suggestionId))
    .limit(1)

  if (!suggestion) {
    throw new Error('PR suggestion not found')
  }

  await db
    .update(prSuggestions)
    .set({
      status: 'REJECTED',
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(prSuggestions.id, suggestionId))

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'PR_SUGGESTION_REJECTED',
    summary: `Rejected PR suggestion for ${suggestion.repoLink}`,
    targetType: 'PROJECT',
    targetId: suggestionId,
  })
}

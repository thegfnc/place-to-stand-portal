import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prSuggestions, githubRepoLinks, emailMetadata } from '@/lib/db/schema'
import { createPullRequest } from '@/lib/github/client'
import { logActivity } from '@/lib/activity/logger'
import type { PRSuggestionWithContext } from '@/lib/types/github'

/**
 * Get pending PR suggestions
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
 * Get single PR suggestion by ID
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
    .where(eq(prSuggestions.id, suggestionId))
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
 * Approve PR suggestion and create GitHub PR
 */
export async function approvePRSuggestion(
  suggestionId: string,
  userId: string,
  modifications?: {
    title?: string
    body?: string
    branch?: string
    baseBranch?: string
  }
): Promise<{ prNumber: number; prUrl: string }> {
  // Get suggestion with repo info
  const result = await getPRSuggestionById(suggestionId)

  if (!result) throw new Error('Suggestion not found')

  if (!['DRAFT', 'PENDING'].includes(result.status)) {
    throw new Error('Suggestion already processed')
  }

  const finalTitle = modifications?.title ?? result.suggestedTitle
  const finalBody = modifications?.body ?? result.suggestedBody
  const finalBranch = modifications?.branch ?? result.suggestedBranch
  const finalBaseBranch = modifications?.baseBranch ?? result.suggestedBaseBranch ?? 'main'

  if (!finalBranch) {
    throw new Error('Branch name is required')
  }

  try {
    // Create PR on GitHub using the OAuth connection linked to this repo
    const pr = await createPullRequest(
      userId,
      result.repoOwner,
      result.repoName,
      {
        title: finalTitle,
        body: finalBody,
        head: finalBranch,
        base: finalBaseBranch,
      },
      result.oauthConnectionId
    )

    // Update suggestion
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
      summary: `Created PR #${pr.number} on ${result.repoLink.repoFullName}`,
      targetType: 'PROJECT',
      targetId: suggestionId,
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        repoFullName: result.repoLink.repoFullName,
      },
    })

    return { prNumber: pr.number, prUrl: pr.html_url }
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
    summary: 'Rejected PR suggestion',
    targetType: 'PROJECT',
    targetId: suggestionId,
  })
}

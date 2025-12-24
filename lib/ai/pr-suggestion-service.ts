import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  prSuggestions,
  githubRepoLinks,
  emailMetadata,
  taskSuggestions,
  projects,
} from '@/lib/db/schema'
import { getMessage, normalizeEmail } from '@/lib/gmail/client'
import { generatePRSuggestion } from './pr-generation'
import type { PRSuggestionWithContext } from '@/lib/types/github'

const MODEL_VERSION = 'gemini-2.5-flash-lite-v1'

/**
 * Sanitize email body for AI processing
 * Removes binary data, excessive whitespace, and non-text content
 */
function sanitizeEmailBody(body: string): string {
  if (!body) return ''

  return body
    // Remove long hex strings (often embedded binary/attachment data)
    .replace(/[a-f0-9]{32,}/gi, '[binary data removed]')
    // Remove base64 encoded blocks
    .replace(/[A-Za-z0-9+/=]{100,}/g, '[encoded data removed]')
    // Remove excessive whitespace
    .replace(/\s{10,}/g, '\n\n')
    // Limit length
    .slice(0, 8000)
}

/**
 * Create a PR suggestion from an email
 */
export async function createPRSuggestionFromEmail(
  emailId: string,
  repoLinkId: string,
  userId: string
): Promise<PRSuggestionWithContext> {
  // Get email metadata
  const [email] = await db
    .select()
    .from(emailMetadata)
    .where(
      and(
        eq(emailMetadata.id, emailId),
        isNull(emailMetadata.deletedAt)
      )
    )
    .limit(1)

  if (!email) throw new Error('Email not found')

  // Get repo link with project info
  const [repoLink] = await db
    .select({
      link: githubRepoLinks,
      projectName: projects.name,
    })
    .from(githubRepoLinks)
    .leftJoin(projects, eq(projects.id, githubRepoLinks.projectId))
    .where(
      and(
        eq(githubRepoLinks.id, repoLinkId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
    .limit(1)

  if (!repoLink) throw new Error('Repo link not found')

  // Get email body from Gmail
  const gmailMessage = await getMessage(userId, email.gmailMessageId)
  const normalized = normalizeEmail(gmailMessage)
  const rawBody = normalized.bodyText || email.snippet || ''
  const emailBody = sanitizeEmailBody(rawBody)

  // Generate suggestion using AI
  const { result } = await generatePRSuggestion({
    emailSubject: email.subject || '',
    emailBody,
    fromEmail: email.fromEmail,
    repoFullName: repoLink.link.repoFullName,
    projectName: repoLink.projectName || undefined,
  })

  // Save suggestion to database
  const [suggestion] = await db
    .insert(prSuggestions)
    .values({
      emailMetadataId: emailId,
      githubRepoLinkId: repoLinkId,
      suggestedTitle: result.title,
      suggestedBody: result.body,
      suggestedBranch: result.suggestedBranch,
      suggestedBaseBranch: repoLink.link.defaultBranch,
      suggestedLabels: result.labels || [],
      suggestedAssignees: [],
      confidence: String(result.confidence),
      reasoning: result.reasoning,
      status: 'DRAFT',
      aiModelVersion: MODEL_VERSION,
    })
    .returning()

  return {
    ...suggestion,
    repoLink: {
      repoFullName: repoLink.link.repoFullName,
      defaultBranch: repoLink.link.defaultBranch,
    },
    email: {
      subject: email.subject,
      fromEmail: email.fromEmail,
    },
  }
}

/**
 * Create a PR suggestion from an approved task suggestion
 */
export async function createPRSuggestionFromTask(
  taskSuggestionId: string,
  repoLinkId: string,
  userId: string
): Promise<PRSuggestionWithContext> {
  // Get task suggestion with email
  const [taskSuggestion] = await db
    .select({
      suggestion: taskSuggestions,
      email: emailMetadata,
    })
    .from(taskSuggestions)
    .innerJoin(emailMetadata, eq(emailMetadata.id, taskSuggestions.emailMetadataId))
    .where(
      and(
        eq(taskSuggestions.id, taskSuggestionId),
        isNull(taskSuggestions.deletedAt)
      )
    )
    .limit(1)

  if (!taskSuggestion) throw new Error('Task suggestion not found')

  // Get repo link with project info
  const [repoLink] = await db
    .select({
      link: githubRepoLinks,
      projectName: projects.name,
    })
    .from(githubRepoLinks)
    .leftJoin(projects, eq(projects.id, githubRepoLinks.projectId))
    .where(
      and(
        eq(githubRepoLinks.id, repoLinkId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
    .limit(1)

  if (!repoLink) throw new Error('Repo link not found')

  // Get email body from Gmail
  const gmailMessage = await getMessage(userId, taskSuggestion.email.gmailMessageId)
  const normalized = normalizeEmail(gmailMessage)
  const rawBody = normalized.bodyText || taskSuggestion.email.snippet || ''
  const emailBody = sanitizeEmailBody(rawBody)

  // Generate suggestion with task context
  const { result } = await generatePRSuggestion({
    emailSubject: taskSuggestion.email.subject || '',
    emailBody,
    fromEmail: taskSuggestion.email.fromEmail,
    repoFullName: repoLink.link.repoFullName,
    projectName: repoLink.projectName || undefined,
    relatedTaskTitle: taskSuggestion.suggestion.suggestedTitle,
    relatedTaskDescription: taskSuggestion.suggestion.suggestedDescription || undefined,
  })

  // Save suggestion
  const [suggestion] = await db
    .insert(prSuggestions)
    .values({
      taskSuggestionId,
      emailMetadataId: taskSuggestion.email.id,
      githubRepoLinkId: repoLinkId,
      suggestedTitle: result.title,
      suggestedBody: result.body,
      suggestedBranch: result.suggestedBranch,
      suggestedBaseBranch: repoLink.link.defaultBranch,
      suggestedLabels: result.labels || [],
      suggestedAssignees: [],
      confidence: String(result.confidence),
      reasoning: result.reasoning,
      status: 'DRAFT',
      aiModelVersion: MODEL_VERSION,
    })
    .returning()

  return {
    ...suggestion,
    repoLink: {
      repoFullName: repoLink.link.repoFullName,
      defaultBranch: repoLink.link.defaultBranch,
    },
    email: {
      subject: taskSuggestion.email.subject,
      fromEmail: taskSuggestion.email.fromEmail,
    },
  }
}

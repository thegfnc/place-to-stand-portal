import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  suggestions,
  githubRepoLinks,
  messages,
  projects,
} from '@/lib/db/schema'
import { getMessage, normalizeEmail } from '@/lib/gmail/client'
import { generatePRSuggestion } from './pr-generation'
import type { NewSuggestion, PRSuggestedContent, SuggestionWithContext } from '@/lib/types/suggestions'

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

export interface PRSuggestionResult {
  id: string
  type: 'PR'
  status: string
  confidence: string
  suggestedContent: PRSuggestedContent
  message?: {
    subject: string | null
    fromEmail: string
  } | null
  githubRepoLink: {
    repoFullName: string
    defaultBranch: string
  }
}

/**
 * Create a PR suggestion from a message
 */
export async function createPRSuggestionFromMessage(
  messageId: string,
  repoLinkId: string,
  userId: string
): Promise<PRSuggestionResult> {
  // Get message
  const [message] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        isNull(messages.deletedAt)
      )
    )
    .limit(1)

  if (!message) throw new Error('Message not found')

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

  // Get message body - use stored body or fetch from Gmail
  let emailBody = message.bodyText || ''

  if (!emailBody && message.externalMessageId) {
    const gmailMessage = await getMessage(userId, message.externalMessageId)
    const normalized = normalizeEmail(gmailMessage)
    emailBody = sanitizeEmailBody(normalized.bodyText || message.snippet || '')
  } else {
    emailBody = sanitizeEmailBody(emailBody || message.snippet || '')
  }

  // Generate suggestion using AI
  const { result } = await generatePRSuggestion({
    emailSubject: message.subject || '',
    emailBody,
    fromEmail: message.fromEmail,
    repoFullName: repoLink.link.repoFullName,
    projectName: repoLink.projectName || undefined,
  })

  // Create unified suggestion with type: PR
  const prContent: PRSuggestedContent = {
    title: result.title,
    body: result.body,
    branch: result.suggestedBranch,
    baseBranch: repoLink.link.defaultBranch,
    labels: result.labels || [],
    assignees: [],
  }

  const [suggestion] = await db
    .insert(suggestions)
    .values({
      messageId,
      threadId: message.threadId,
      type: 'PR',
      status: 'DRAFT',
      projectId: repoLink.link.projectId,
      githubRepoLinkId: repoLinkId,
      confidence: String(result.confidence),
      reasoning: result.reasoning,
      aiModelVersion: MODEL_VERSION,
      suggestedContent: prContent,
    })
    .returning()

  return {
    id: suggestion.id,
    type: 'PR',
    status: suggestion.status,
    confidence: suggestion.confidence,
    suggestedContent: prContent,
    message: {
      subject: message.subject,
      fromEmail: message.fromEmail,
    },
    githubRepoLink: {
      repoFullName: repoLink.link.repoFullName,
      defaultBranch: repoLink.link.defaultBranch,
    },
  }
}

/**
 * Create a PR suggestion from an existing task suggestion
 */
export async function createPRSuggestionFromTaskSuggestion(
  taskSuggestionId: string,
  repoLinkId: string,
  userId: string
): Promise<PRSuggestionResult> {
  // Get task suggestion with message
  const [taskSuggestion] = await db
    .select({
      suggestion: suggestions,
      message: messages,
    })
    .from(suggestions)
    .innerJoin(messages, eq(messages.id, suggestions.messageId))
    .where(
      and(
        eq(suggestions.id, taskSuggestionId),
        eq(suggestions.type, 'TASK'),
        isNull(suggestions.deletedAt)
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

  // Get message body
  let emailBody = taskSuggestion.message.bodyText || ''

  if (!emailBody && taskSuggestion.message.externalMessageId) {
    const gmailMessage = await getMessage(userId, taskSuggestion.message.externalMessageId)
    const normalized = normalizeEmail(gmailMessage)
    emailBody = sanitizeEmailBody(normalized.bodyText || taskSuggestion.message.snippet || '')
  } else {
    emailBody = sanitizeEmailBody(emailBody || taskSuggestion.message.snippet || '')
  }

  // Get task context from suggestion
  const taskContent = taskSuggestion.suggestion.suggestedContent as { title?: string; description?: string }

  // Generate suggestion with task context
  const { result } = await generatePRSuggestion({
    emailSubject: taskSuggestion.message.subject || '',
    emailBody,
    fromEmail: taskSuggestion.message.fromEmail,
    repoFullName: repoLink.link.repoFullName,
    projectName: repoLink.projectName || undefined,
    relatedTaskTitle: taskContent.title,
    relatedTaskDescription: taskContent.description,
  })

  // Create unified suggestion with type: PR
  const prContent: PRSuggestedContent = {
    title: result.title,
    body: result.body,
    branch: result.suggestedBranch,
    baseBranch: repoLink.link.defaultBranch,
    labels: result.labels || [],
    assignees: [],
  }

  const [suggestion] = await db
    .insert(suggestions)
    .values({
      messageId: taskSuggestion.message.id,
      threadId: taskSuggestion.message.threadId,
      type: 'PR',
      status: 'DRAFT',
      projectId: repoLink.link.projectId,
      githubRepoLinkId: repoLinkId,
      confidence: String(result.confidence),
      reasoning: result.reasoning,
      aiModelVersion: MODEL_VERSION,
      suggestedContent: prContent,
    })
    .returning()

  return {
    id: suggestion.id,
    type: 'PR',
    status: suggestion.status,
    confidence: suggestion.confidence,
    suggestedContent: prContent,
    message: {
      subject: taskSuggestion.message.subject,
      fromEmail: taskSuggestion.message.fromEmail,
    },
    githubRepoLink: {
      repoFullName: repoLink.link.repoFullName,
      defaultBranch: repoLink.link.defaultBranch,
    },
  }
}

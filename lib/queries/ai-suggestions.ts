import 'server-only'

import { and, desc, eq, isNull, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  emailLinks,
  emailMetadata,
  taskSuggestions,
} from '@/lib/db/schema'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EmailSuggestion = {
  id: string
  suggestedTitle: string
  suggestedDescription: string | null
  suggestedDueDate: string | null
  suggestedPriority: string | null
  confidence: string
  reasoning: string | null
  status: string
}

export type EmailWithSuggestions = {
  id: string
  subject: string | null
  snippet: string | null
  fromEmail: string
  fromName: string | null
  receivedAt: string | null
  suggestions: EmailSuggestion[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get emails linked to a client along with their task suggestions.
 * This is the main query for the AI Suggestions panel on the project board.
 */
export async function getClientEmailsWithSuggestions(
  clientId: string,
  options: { limit?: number; pendingOnly?: boolean } = {}
): Promise<EmailWithSuggestions[]> {
  const { limit = 50, pendingOnly = false } = options

  // Step 1: Get emails linked to this client
  const emailRows = await db
    .select({
      id: emailMetadata.id,
      subject: emailMetadata.subject,
      snippet: emailMetadata.snippet,
      fromEmail: emailMetadata.fromEmail,
      fromName: emailMetadata.fromName,
      receivedAt: emailMetadata.receivedAt,
    })
    .from(emailLinks)
    .innerJoin(emailMetadata, eq(emailMetadata.id, emailLinks.emailMetadataId))
    .where(
      and(
        eq(emailLinks.clientId, clientId),
        isNull(emailLinks.deletedAt),
        isNull(emailMetadata.deletedAt)
      )
    )
    .orderBy(desc(emailMetadata.receivedAt))
    .limit(limit)

  if (emailRows.length === 0) {
    return []
  }

  const emailIds = emailRows.map(e => e.id)

  // Step 2: Get task suggestions for these emails
  const suggestionConditions = [
    inArray(taskSuggestions.emailMetadataId, emailIds),
    isNull(taskSuggestions.deletedAt),
  ]

  if (pendingOnly) {
    suggestionConditions.push(eq(taskSuggestions.status, 'PENDING'))
  }

  const suggestionRows = await db
    .select({
      id: taskSuggestions.id,
      emailMetadataId: taskSuggestions.emailMetadataId,
      suggestedTitle: taskSuggestions.suggestedTitle,
      suggestedDescription: taskSuggestions.suggestedDescription,
      suggestedDueDate: taskSuggestions.suggestedDueDate,
      suggestedPriority: taskSuggestions.suggestedPriority,
      confidence: taskSuggestions.confidence,
      reasoning: taskSuggestions.reasoning,
      status: taskSuggestions.status,
    })
    .from(taskSuggestions)
    .where(and(...suggestionConditions))
    .orderBy(desc(taskSuggestions.confidence))

  // Step 3: Group suggestions by email
  const suggestionsByEmail = new Map<string, EmailSuggestion[]>()
  for (const row of suggestionRows) {
    const suggestions = suggestionsByEmail.get(row.emailMetadataId) ?? []
    suggestions.push({
      id: row.id,
      suggestedTitle: row.suggestedTitle,
      suggestedDescription: row.suggestedDescription,
      suggestedDueDate: row.suggestedDueDate,
      suggestedPriority: row.suggestedPriority,
      confidence: row.confidence,
      reasoning: row.reasoning,
      status: row.status,
    })
    suggestionsByEmail.set(row.emailMetadataId, suggestions)
  }

  // Step 4: Combine emails with their suggestions
  // If pendingOnly, filter to only emails that have pending suggestions
  const result: EmailWithSuggestions[] = []

  for (const email of emailRows) {
    const suggestions = suggestionsByEmail.get(email.id) ?? []

    // If filtering to pending only and no suggestions, skip this email
    if (pendingOnly && suggestions.length === 0) {
      continue
    }

    result.push({
      id: email.id,
      subject: email.subject,
      snippet: email.snippet,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      receivedAt: email.receivedAt,
      suggestions,
    })
  }

  return result
}

/**
 * Get count of pending suggestions for emails linked to a client.
 * Used for the badge on the AI Suggestions button.
 */
export async function getClientPendingSuggestionCount(
  clientId: string
): Promise<number> {
  // Get email IDs linked to client
  const emailRows = await db
    .select({ id: emailLinks.emailMetadataId })
    .from(emailLinks)
    .where(
      and(
        eq(emailLinks.clientId, clientId),
        isNull(emailLinks.deletedAt)
      )
    )

  if (emailRows.length === 0) {
    return 0
  }

  const emailIds = emailRows.map(e => e.id)

  // Count pending suggestions for these emails
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(taskSuggestions)
    .where(
      and(
        inArray(taskSuggestions.emailMetadataId, emailIds),
        eq(taskSuggestions.status, 'PENDING'),
        isNull(taskSuggestions.deletedAt)
      )
    )

  return result?.count ?? 0
}

/**
 * Get email IDs linked to client that haven't been analyzed yet.
 * Used to determine if we should show "Analyze New Emails" button.
 */
export async function getUnanalyzedClientEmailIds(
  clientId: string
): Promise<string[]> {
  // Get all email IDs linked to client
  const linkedEmails = await db
    .select({ emailId: emailLinks.emailMetadataId })
    .from(emailLinks)
    .innerJoin(emailMetadata, eq(emailMetadata.id, emailLinks.emailMetadataId))
    .where(
      and(
        eq(emailLinks.clientId, clientId),
        isNull(emailLinks.deletedAt),
        isNull(emailMetadata.deletedAt)
      )
    )

  if (linkedEmails.length === 0) {
    return []
  }

  const allEmailIds = linkedEmails.map(e => e.emailId)

  // Get email IDs that have been analyzed (have at least one suggestion)
  const analyzedEmails = await db
    .select({ emailId: taskSuggestions.emailMetadataId })
    .from(taskSuggestions)
    .where(
      and(
        inArray(taskSuggestions.emailMetadataId, allEmailIds),
        isNull(taskSuggestions.deletedAt)
      )
    )
    .groupBy(taskSuggestions.emailMetadataId)

  const analyzedSet = new Set(analyzedEmails.map(e => e.emailId))

  // Return email IDs that haven't been analyzed
  return allEmailIds.filter(id => !analyzedSet.has(id))
}

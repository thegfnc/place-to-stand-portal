import { config } from 'dotenv'
config({ path: '.env.local' })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq, isNull, desc, sql } from 'drizzle-orm'
import {
  emailMetadata,
  emailLinks,
  clients,
  taskSuggestions,
  oauthConnections,
} from '../lib/db/schema'
import * as crypto from 'crypto'
import { z } from 'zod'
import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'

const queryClient = postgres(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
)
const db = drizzle(queryClient)

// Encryption
const ALGORITHM = 'aes-256-gcm'
function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  if (!key) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY required')
  return Buffer.from(key, 'base64')
}
function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey()
  const data = Buffer.from(encryptedToken, 'base64')
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const encrypted = data.subarray(32)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// Gmail helpers
async function getValidAccessToken(userId: string): Promise<string> {
  const [conn] = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))
    .limit(1)
  if (!conn) throw new Error('Google account not connected')
  return decryptToken(conn.accessToken)
}

interface GmailMessage {
  id: string
  threadId?: string
  snippet?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body?: { data?: string }
      parts?: Array<{ mimeType: string; body?: { data?: string } }>
    }>
    body?: { data?: string }
    mimeType?: string
  }
}

async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
  url.searchParams.set('format', 'full')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail get failed: ${res.status}`)
  return res.json()
}

function extractTextBody(msg: GmailMessage): string {
  const payload = msg.payload
  if (!payload) return ''

  type MessagePart = NonNullable<typeof payload.parts>[number]
  function findTextPart(parts: MessagePart[] | undefined): string {
    if (!parts) return ''
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8')
      }
      if (part.parts) {
        const nested = findTextPart(part.parts)
        if (nested) return nested
      }
    }
    return ''
  }

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8')
  }

  if (payload.parts) {
    return findTextPart(payload.parts)
  }

  return ''
}

// AI Analysis schemas
const extractedTaskSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
})

const emailAnalysisResultSchema = z.object({
  tasks: z.array(extractedTaskSchema),
  noActionRequired: z.boolean(),
  summary: z.string().max(500),
})

const EMAIL_ANALYSIS_SYSTEM_PROMPT = `You are an intelligent email assistant that analyzes emails to extract actionable tasks.

Your job is to:
1. Read the email carefully
2. Identify any tasks, requests, or action items mentioned
3. Extract each task with a clear title, description, and estimated priority

Guidelines:
- A task should be a specific, actionable item that requires action from the recipient
- Do NOT create tasks for informational emails, newsletters, or marketing emails
- Do NOT create tasks for automated notifications unless they require human action
- Priority should be HIGH for urgent/deadline-driven items, MEDIUM for normal requests, LOW for nice-to-haves
- Confidence should reflect how certain you are that this is a real task (0.0 to 1.0)
- If an email contains no actionable tasks, set noActionRequired to true

Be conservative - only extract clear, actionable tasks. It's better to miss a borderline task than to create noise.`

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-2.5-flash-lite')

async function analyzeEmail(params: {
  subject: string
  body: string
  fromEmail: string
  fromName?: string
  receivedAt: string
  clientName?: string
}) {
  const userPrompt = `Analyze this email and extract any actionable tasks:

From: ${params.fromName || params.fromEmail} <${params.fromEmail}>
Date: ${params.receivedAt}
Subject: ${params.subject}
${params.clientName ? `Client: ${params.clientName}` : ''}

Body:
${params.body.slice(0, 4000)}`

  const { object, usage } = await generateObject({
    model,
    system: EMAIL_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: emailAnalysisResultSchema,
  })

  return { result: object, usage }
}

async function main() {
  console.log('Testing AI analysis on linked emails...\n')

  // Get linked emails with client info
  const linkedEmails = await db
    .select({
      id: emailMetadata.id,
      userId: emailMetadata.userId,
      gmailMessageId: emailMetadata.gmailMessageId,
      subject: emailMetadata.subject,
      fromEmail: emailMetadata.fromEmail,
      fromName: emailMetadata.fromName,
      receivedAt: emailMetadata.receivedAt,
      clientId: emailLinks.clientId,
      clientName: clients.name,
    })
    .from(emailMetadata)
    .innerJoin(emailLinks, eq(emailLinks.emailMetadataId, emailMetadata.id))
    .innerJoin(clients, eq(clients.id, emailLinks.clientId))
    .where(
      and(
        isNull(emailMetadata.deletedAt),
        isNull(emailLinks.deletedAt),
        isNull(clients.deletedAt)
      )
    )
    .orderBy(desc(emailMetadata.receivedAt))
    .limit(10)

  console.log(`Found ${linkedEmails.length} linked emails to analyze\n`)

  if (linkedEmails.length === 0) {
    console.log('No linked emails found')
    await queryClient.end()
    return
  }

  // Get access token
  const userId = linkedEmails[0].userId
  const accessToken = await getValidAccessToken(userId)
  console.log('Got access token\n')

  let suggestionsCreated = 0

  for (const email of linkedEmails) {
    console.log('---')
    console.log(`Email: ${email.subject || '(no subject)'}`)
    console.log(`From: ${email.fromEmail}`)
    console.log(`Client: ${email.clientName}`)

    // Check if already analyzed
    const [existing] = await db
      .select({ id: taskSuggestions.id })
      .from(taskSuggestions)
      .where(
        and(
          eq(taskSuggestions.emailMetadataId, email.id),
          isNull(taskSuggestions.deletedAt)
        )
      )
      .limit(1)

    if (existing) {
      console.log('Already analyzed, skipping\n')
      continue
    }

    // Get email body from Gmail
    let body = ''
    try {
      const msg = await getGmailMessage(accessToken, email.gmailMessageId)
      body = extractTextBody(msg)
    } catch (err) {
      console.log(`Failed to fetch body: ${err}`)
      continue
    }

    if (!body) {
      console.log('No body content, skipping\n')
      continue
    }

    console.log(`Body length: ${body.length} chars`)

    // Analyze with AI
    try {
      const { result, usage } = await analyzeEmail({
        subject: email.subject || '',
        body,
        fromEmail: email.fromEmail,
        fromName: email.fromName || undefined,
        receivedAt: email.receivedAt,
        clientName: email.clientName,
      })

      console.log(`AI Result: ${result.noActionRequired ? 'No action required' : `${result.tasks.length} tasks found`}`)
      console.log(`Summary: ${result.summary}`)
      console.log(`Tokens: ${usage?.inputTokens ?? 0} prompt, ${usage?.outputTokens ?? 0} completion`)

      if (!result.noActionRequired && result.tasks.length > 0) {
        // Save suggestions
        const suggestions = result.tasks
          .filter(t => t.confidence >= 0.5)
          .map(task => ({
            emailMetadataId: email.id,
            projectId: null,
            suggestedTitle: task.title,
            suggestedDescription: task.description || null,
            suggestedDueDate: task.dueDate || null,
            suggestedPriority: task.priority || null,
            suggestedAssignees: [],
            confidence: String(task.confidence),
            reasoning: task.reasoning,
            status: 'PENDING' as const,
            aiModelVersion: 'gemini-2.0-flash-lite-v1',
            promptTokens: Math.round((usage?.inputTokens ?? 0) / result.tasks.length),
            completionTokens: Math.round((usage?.outputTokens ?? 0) / result.tasks.length),
          }))

        if (suggestions.length > 0) {
          await db.insert(taskSuggestions).values(suggestions)
          suggestionsCreated += suggestions.length
          console.log(`Created ${suggestions.length} suggestion(s)`)

          for (const task of result.tasks) {
            console.log(`  - [${task.priority || 'MEDIUM'}] ${task.title} (${(task.confidence * 100).toFixed(0)}%)`)
          }
        }
      }
    } catch (err) {
      console.log(`AI error: ${err}`)
    }

    console.log()
  }

  // Final stats
  const [suggestionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskSuggestions)
    .where(isNull(taskSuggestions.deletedAt))

  console.log('---')
  console.log(`\nDone! Created ${suggestionsCreated} new suggestions`)
  console.log(`Total suggestions in DB: ${suggestionCount.count}`)

  await queryClient.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

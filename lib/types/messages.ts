import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { threads, messages, messageAttachments, emailRaw } from '@/lib/db/schema'

// Base types from schema
export type Thread = InferSelectModel<typeof threads>
export type NewThread = InferInsertModel<typeof threads>

export type Message = InferSelectModel<typeof messages>
export type NewMessage = InferInsertModel<typeof messages>

export type MessageAttachment = InferSelectModel<typeof messageAttachments>
export type NewMessageAttachment = InferInsertModel<typeof messageAttachments>

export type EmailRaw = InferSelectModel<typeof emailRaw>
export type NewEmailRaw = InferInsertModel<typeof emailRaw>

// Enum types
export type MessageSource = 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM'
export type ThreadStatus = 'OPEN' | 'RESOLVED' | 'ARCHIVED'

// Thread with related data for UI
export interface ThreadWithMessages extends Thread {
  messages: Message[]
  client?: {
    id: string
    name: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}

// Thread summary for list views
export interface ThreadSummary {
  id: string
  subject: string | null
  status: ThreadStatus
  source: MessageSource
  participantEmails: string[]
  lastMessageAt: string | null
  messageCount: number
  client?: {
    id: string
    name: string
  } | null
  project?: {
    id: string
    name: string
  } | null
  // Preview of latest message
  latestMessage?: {
    id: string
    snippet: string | null
    fromEmail: string
    fromName: string | null
    sentAt: string
    isInbound: boolean
    isRead: boolean
  } | null
}

// Message with attachments for detail view
export interface MessageWithAttachments extends Message {
  attachments: MessageAttachment[]
  thread?: {
    id: string
    subject: string | null
  }
}

// Inbox item (can be a thread or standalone message)
export interface InboxItem {
  id: string
  type: 'thread' | 'message'
  subject: string | null
  snippet: string | null
  source: MessageSource
  fromEmail: string
  fromName: string | null
  participantEmails: string[]
  timestamp: string
  isRead: boolean
  hasAttachments: boolean
  messageCount: number
  hasSuggestions: boolean
  pendingSuggestionCount: number
  client?: {
    id: string
    name: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}

// Inbox filters
export interface InboxFilters {
  status?: ThreadStatus | 'all'
  source?: MessageSource | 'all'
  clientId?: string
  projectId?: string
  isRead?: boolean
  hasSuggestions?: boolean
  search?: string
}

// Inbox counts for filter badges
export interface InboxCounts {
  all: number
  unread: number
  withSuggestions: number
  byStatus: Record<ThreadStatus, number>
  bySource: Record<MessageSource, number>
}

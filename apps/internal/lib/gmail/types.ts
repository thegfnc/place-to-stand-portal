export interface GmailHeader {
  name: string
  value: string
}

export interface GmailBodyPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: GmailBodyPart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  payload?: GmailBodyPart
  sizeEstimate?: number
  historyId?: string
  internalDate?: string
}

export interface GmailListResponse {
  messages?: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

export type NormalizedEmail = {
  id: string
  subject: string | null
  from: string | null
  to: string[]
  cc: string[]
  date: string | null
  snippet?: string
  bodyText?: string
  bodyHtml?: string
}

// =============================================================================
// HISTORY API TYPES (for incremental sync)
// =============================================================================

/** Message reference with optional label IDs (used in history responses) */
export interface GmailMessageRef {
  id: string
  threadId: string
  labelIds?: string[]
}

/** Label change event in history */
export interface GmailLabelChange {
  message: GmailMessageRef
  labelIds: string[]
}

/** Single history record representing changes to the mailbox */
export interface GmailHistoryRecord {
  id: string
  messagesAdded?: Array<{ message: GmailMessageRef }>
  messagesDeleted?: Array<{ message: GmailMessageRef }>
  labelsAdded?: GmailLabelChange[]
  labelsRemoved?: GmailLabelChange[]
}

/** Response from users.history.list API */
export interface GmailHistoryResponse {
  history?: GmailHistoryRecord[]
  nextPageToken?: string
  historyId: string
}

/** History types that can be filtered in history.list requests */
export type GmailHistoryType = 'messageAdded' | 'messageDeleted' | 'labelAdded' | 'labelRemoved'


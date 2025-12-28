export interface GmailHeader {
  name: string
  value: string
}

export interface GmailBodyPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { size?: number; data?: string }
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


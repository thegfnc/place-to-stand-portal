import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { emailMetadata, emailLinks } from '@/lib/db/schema'

export type EmailMetadata = InferSelectModel<typeof emailMetadata>
export type NewEmailMetadata = InferInsertModel<typeof emailMetadata>

export type EmailLink = InferSelectModel<typeof emailLinks>
export type NewEmailLink = InferInsertModel<typeof emailLinks>

export type EmailLinkSource = 'AUTOMATIC' | 'MANUAL_FORWARD' | 'MANUAL_LINK'

export interface EmailWithLinks extends EmailMetadata {
  links: Array<{
    id: string
    source: EmailLinkSource
    confidence: string | null
    client: { id: string; name: string } | null
    project: { id: string; name: string } | null
  }>
}


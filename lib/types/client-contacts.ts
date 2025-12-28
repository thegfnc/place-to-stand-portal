import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { clientContacts } from '@/lib/db/schema'

export type ClientContact = InferSelectModel<typeof clientContacts>
export type NewClientContact = InferInsertModel<typeof clientContacts>

export interface ClientContactWithClient extends ClientContact {
  client: {
    id: string
    name: string
    slug: string | null
  }
}


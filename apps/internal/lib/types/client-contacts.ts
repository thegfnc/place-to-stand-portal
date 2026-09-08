import type { InferSelectModel } from 'drizzle-orm'
import type { contacts } from '@/lib/db/schema'

// Base contact types
type Contact = InferSelectModel<typeof contacts>
// Junction table types
// Contact with linked clients
// Contact with isPrimary from a specific client's junction record
// Used when displaying contacts for a single client
export interface ContactWithClientLink extends Contact {
  isPrimary: boolean
}

// Contact with linked leads
// Backwards compatibility - deprecated types

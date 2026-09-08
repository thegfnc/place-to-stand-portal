import 'server-only'

import { createDb } from '@pts/db/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

declare global {
  var __drizzle_db__: ReturnType<typeof createDb> | undefined
}

export const db = globalThis.__drizzle_db__ ?? createDb(databaseUrl)

if (process.env.NODE_ENV !== 'production') {
  globalThis.__drizzle_db__ = db
}



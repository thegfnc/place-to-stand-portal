import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

declare global {
  var __drizzle_postgres__: ReturnType<typeof postgres> | undefined
}

const client =
  globalThis.__drizzle_postgres__ ?? postgres(databaseUrl, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__drizzle_postgres__ = client
}

export const db = drizzle(client)

export type DbClient = typeof db

import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { serverEnv } from '@/lib/env.server'

import * as schema from './schema'

type DrizzleClient = PostgresJsDatabase<typeof schema>
type PostgresClient = ReturnType<typeof postgres>

const globalForDrizzle = globalThis as unknown as {
  __db__?: DrizzleClient
  __pg__?: PostgresClient
}

function createPostgresClient(): PostgresClient {
  const url = new URL(serverEnv.DATABASE_URL)

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[db] connecting to',
      `${url.hostname}:${url.port}${url.search}`
    )
  }

  const shouldUseSSL =
    !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')

  return postgres(url.toString(), {
    max: 1,
    ssl: shouldUseSSL ? { rejectUnauthorized: false } : undefined,
    prepare: false,
    connect_timeout: 5, // 5s; tweak as needed
    idle_timeout: 5, // drop the socket quickly on serverless
  })
}

function createDrizzleClient(pgClient: PostgresClient): DrizzleClient {
  return drizzle(pgClient, { schema })
}

export function getDb(): DrizzleClient {
  if (!globalForDrizzle.__db__) {
    const pgClient = globalForDrizzle.__pg__ ?? createPostgresClient()
    const db = createDrizzleClient(pgClient)

    globalForDrizzle.__pg__ = pgClient
    globalForDrizzle.__db__ = db
  }

  return globalForDrizzle.__db__
}

export const db = getDb()
export { schema }

import 'server-only'

import { createDb } from '@pts/db/client'

declare global {
  var __drizzle_db__: ReturnType<typeof createDb> | undefined
}

function getDb() {
  if (globalThis.__drizzle_db__) {
    return globalThis.__drizzle_db__
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const instance = createDb(databaseUrl)

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__drizzle_db__ = instance
  }

  return instance
}

// Lazy proxy: db is created on first property access, not at import time.
// This avoids build failures when DATABASE_URL isn't available during static analysis.
export const db: ReturnType<typeof createDb> = new Proxy(
  {} as ReturnType<typeof createDb>,
  {
    get(_target, prop, receiver) {
      const instance = getDb()
      const value = Reflect.get(instance, prop, receiver)
      if (typeof value === 'function') {
        return value.bind(instance)
      }
      return value
    },
  }
)



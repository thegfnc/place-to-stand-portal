'use server'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { hourBlocks, projects } from '@/lib/db/schema'

export async function countProjectsForClient(clientId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))

  return Number(result[0]?.count ?? 0)
}

export async function countHourBlocksForClient(clientId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(hourBlocks)
    .where(eq(hourBlocks.clientId, clientId))

  return Number(result[0]?.count ?? 0)
}


'use server'

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, users } from '@/lib/db/schema'
import type { Database, Json } from '@/lib/supabase/types'
import type { ActivityTargetType, ActivityVerb } from './types'

export type LogActivityOptions = {
  actorId: string
  actorRole?: Database['public']['Enums']['user_role'] | null
  verb: ActivityVerb
  summary: string
  targetType: ActivityTargetType | string
  targetId?: string | null
  targetClientId?: string | null
  targetProjectId?: string | null
  contextRoute?: string | null
  metadata?: Json
}

const DEFAULT_ACTOR_ROLE: Database['public']['Enums']['user_role'] = 'ADMIN'

export async function logActivity(options: LogActivityOptions) {
  try {
    const actorRole = await resolveActorRole(
      options.actorId,
      options.actorRole
    )

    await db.insert(activityLogs).values({
      actorId: options.actorId,
      actorRole,
      verb: options.verb,
      summary: options.summary,
      targetType: options.targetType,
      targetId: options.targetId ?? null,
      targetClientId: options.targetClientId ?? null,
      targetProjectId: options.targetProjectId ?? null,
      contextRoute: options.contextRoute ?? null,
      metadata: normalizeMetadata(options.metadata),
    })
  } catch (error) {
    console.error('Failed to log activity', {
      verb: options.verb,
      actorId: options.actorId,
      targetType: options.targetType,
      targetId: options.targetId ?? null,
      error,
    })
  }
}

async function resolveActorRole(
  actorId: string,
  providedRole?: Database['public']['Enums']['user_role'] | null
): Promise<Database['public']['Enums']['user_role']> {
  if (providedRole) {
    return providedRole
  }

  try {
    const rows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1)

    const role = rows[0]?.role

    if (role) {
      return role
    }
  } catch (error) {
    console.error('Failed to resolve actor role for activity log', {
      actorId,
      error,
    })
  }

  return DEFAULT_ACTOR_ROLE
}

function normalizeMetadata(metadata?: Json): Json {
  if (metadata === undefined || metadata === null) {
    return {}
  }

  return JSON.parse(JSON.stringify(metadata)) as Json
}

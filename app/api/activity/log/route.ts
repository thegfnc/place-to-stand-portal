import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { ActivityVerbs, type ActivityVerb } from '@/lib/activity/types'
import { requireUser } from '@/lib/auth/session'
import type { Json } from '@/lib/supabase/types'

const TARGET_TYPES = [
  'TASK',
  'PROJECT',
  'CLIENT',
  'COMMENT',
  'TIME_LOG',
  'HOUR_BLOCK',
  'USER',
  'SETTINGS',
  'GENERAL',
] as const

const VERB_VALUES = Object.values(ActivityVerbs) as [ActivityVerb, ...ActivityVerb[]]

const logSchema = z.object({
  actorId: z.string().uuid().optional(),
  verb: z.enum(VERB_VALUES),
  summary: z.string().trim().min(1),
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().uuid().nullable().optional(),
  targetClientId: z.string().uuid().nullable().optional(),
  targetProjectId: z.string().uuid().nullable().optional(),
  contextRoute: z.string().trim().nullable().optional(),
  metadata: z
    .unknown()
    .optional()
    .refine(value => value === undefined || isJsonValue(value), {
      message: 'Metadata must be JSON serializable.',
    }),
})

export async function POST(request: Request) {
  const user = await requireUser()

  let payload: z.infer<typeof logSchema>

  try {
    const body = await request.json()
    payload = logSchema.parse(body)
  } catch (error) {
    console.error('Invalid client activity log payload', error)
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    )
  }

  if (payload.actorId && payload.actorId !== user.id) {
    console.warn('Client attempted to log activity with mismatched actor', {
      actorId: payload.actorId,
      userId: user.id,
    })
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: payload.verb,
    summary: payload.summary,
    targetType: payload.targetType,
    targetId: payload.targetId ?? null,
    targetClientId: payload.targetClientId ?? null,
    targetProjectId: payload.targetProjectId ?? null,
    contextRoute: payload.contextRoute ?? null,
    metadata: (payload.metadata ?? undefined) as Json | undefined,
  })

  return new Response(null, { status: 204 })
}

function isJsonValue(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }

if (typeof value === 'object' && value !== null) {
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value as Record<string, unknown>).every(isJsonValue)
  }

  return false
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { fetchActivityLogs } from '@/lib/activity/queries'
import type { ActivityTargetType } from '@/lib/activity/types'
import { getCurrentUser } from '@/lib/auth/session'

const VALID_TARGET_TYPES: ActivityTargetType[] = [
  'TASK',
  'PROJECT',
  'CLIENT',
  'COMMENT',
  'TIME_LOG',
  'HOUR_BLOCK',
  'USER',
  'SETTINGS',
  'GENERAL',
]

const isActivityTargetType = (
  value: string | null
): value is ActivityTargetType => {
  if (!value) {
    return false
  }

  return VALID_TARGET_TYPES.includes(value as ActivityTargetType)
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  const targetTypeParams = params.getAll('targetType').filter(Boolean)
  const legacyTargetTypeParam = params.get('targetType')
  const targetId = params.get('targetId')
  const projectId = params.get('projectId')
  const clientId = params.get('clientId')
  const cursor = params.get('cursor')
  const limitParam = params.get('limit')

  const requestedTargetTypes = targetTypeParams.length
    ? targetTypeParams
    : legacyTargetTypeParam
      ? [legacyTargetTypeParam]
      : []

  if (!requestedTargetTypes.length && !targetId && !projectId && !clientId) {
    return NextResponse.json(
      { error: 'A target filter is required.' },
      { status: 400 }
    )
  }

  let targetType: ActivityTargetType | ActivityTargetType[] | undefined

  if (requestedTargetTypes.length) {
    const invalid = requestedTargetTypes.filter(
      value => !isActivityTargetType(value)
    )

    if (invalid.length) {
      return NextResponse.json(
        { error: 'Unsupported activity target type.' },
        { status: 400 }
      )
    }

    targetType =
      requestedTargetTypes.length === 1
        ? (requestedTargetTypes[0] as ActivityTargetType)
        : (requestedTargetTypes as ActivityTargetType[])
  }

  let limit: number | undefined

  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10)

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: 'Limit must be a positive integer.' },
        { status: 400 }
      )
    }

    limit = parsed
  }

  try {
    const result = await fetchActivityLogs({
      targetType,
      targetId: targetId ?? undefined,
      projectId: projectId ?? undefined,
      clientId: clientId ?? undefined,
      cursor: cursor ?? undefined,
      limit,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to resolve activity logs', error)
    return NextResponse.json(
      { error: 'Unable to load activity history.' },
      { status: 500 }
    )
  }
}

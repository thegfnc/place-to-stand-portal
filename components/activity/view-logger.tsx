'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

import { logClientActivity } from '@/lib/activity/client'
import type { ActivityTargetType, ActivityVerb } from '@/lib/activity/types'
import type { Json } from '@/lib/types/json'

export type ViewLoggerProps = {
  actorId: string
  verb: ActivityVerb
  summary: string
  targetType: ActivityTargetType | string
  targetId?: string | null
  targetClientId?: string | null
  targetProjectId?: string | null
  metadata?: Json
}

export function ViewLogger({
  actorId,
  verb,
  summary,
  targetType,
  targetId = null,
  targetClientId = null,
  targetProjectId = null,
  metadata,
}: ViewLoggerProps) {
  const pathname = usePathname()
  const lastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!actorId || !verb) {
      return
    }

    const key = [
      actorId,
      verb,
      targetType,
      targetId ?? '',
      targetClientId ?? '',
      targetProjectId ?? '',
    ].join(':')

    if (lastKeyRef.current === key) {
      return
    }

    lastKeyRef.current = key

    void logClientActivity(
      {
        verb,
        summary,
        metadata,
      },
      {
        actorId,
        targetType,
        targetId,
        targetClientId,
        targetProjectId,
        contextRoute: pathname ?? null,
      }
    )
  }, [
    actorId,
    verb,
    summary,
    targetType,
    targetId,
    targetClientId,
    targetProjectId,
    metadata,
    pathname,
  ])

  return null
}

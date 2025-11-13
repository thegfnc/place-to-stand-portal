'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { consumeBoardTabSwitch } from '@/lib/posthog/board-tab-switch'
import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'

type BoardTabName = 'board' | 'calendar' | 'backlog' | 'activity' | 'review'

type BoardTabInfo = {
  tab: BoardTabName
  clientSlug: string | null
  projectSlug: string | null
}

const BOARD_VIEWS: ReadonlyArray<BoardTabName> = [
  'board',
  'calendar',
  'backlog',
  'activity',
  'review',
] as const

const BOARD_VIEW_SET = new Set<string>(BOARD_VIEWS)

const BOARD_ROUTE_PATTERN =
  /^\/projects\/([^/]+)\/([^/]+)\/(board|calendar|backlog|activity|review)(?:\/|$)/

function parseBoardTab(url: string): BoardTabInfo | null {
  const match = BOARD_ROUTE_PATTERN.exec(url)

  if (match) {
    return {
      clientSlug: match[1],
      projectSlug: match[2],
      tab: match[3] as BoardTabName,
    }
  }

  const segments = url.split('?')[0]?.split('/').filter(Boolean) ?? []

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (BOARD_VIEW_SET.has(segment)) {
      return {
        clientSlug: null,
        projectSlug: null,
        tab: segment as BoardTabName,
      }
    }
  }

  return null
}

export function RouterTransitionTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousUrlRef = useRef<string | null>(null)
  const search = searchParams?.toString() ?? ''

  useEffect(() => {
    if (!pathname) {
      return
    }

    const url = search ? `${pathname}?${search}` : pathname

    if (previousUrlRef.current === url) {
      return
    }

    const navigationEntry =
      typeof performance !== 'undefined'
        ? performance.getEntriesByType('navigation').at(-1)
        : undefined
    const navigationType =
      navigationEntry && 'type' in navigationEntry
        ? (navigationEntry as PerformanceNavigationTiming).type
        : undefined

    const interaction = startClientInteraction(
      INTERACTION_EVENTS.ROUTER_TRANSITION,
      {
        metadata: {
          to: url,
          from: previousUrlRef.current,
          navigationType,
        },
      }
    )

    interaction.end({
      status: 'success',
      to: url,
      from: previousUrlRef.current,
      navigationType,
    })

    const currentBoardTab = parseBoardTab(pathname)
    const boardSwitchContext = consumeBoardTabSwitch(
      currentBoardTab?.tab ?? null
    )

    if (boardSwitchContext) {
      boardSwitchContext.handle.end({
        status: 'success',
        fromView: boardSwitchContext.fromView,
        toView: boardSwitchContext.toView,
        projectId: boardSwitchContext.projectId,
        tab: currentBoardTab?.tab,
        clientSlug: currentBoardTab?.clientSlug ?? null,
        projectSlug: currentBoardTab?.projectSlug ?? null,
        navigationType,
      })
    }

    previousUrlRef.current = url
  }, [pathname, search])

  return null
}

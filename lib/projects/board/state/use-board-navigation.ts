import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { ProjectWithRelations } from '@/lib/types'

import { BOARD_BASE_PATH, MISSING_SLUG_MESSAGE } from '../board-constants'
import { buildBoardPath } from '../board-utils'
import type { NavigateOptions } from './types'

type RouterLike = {
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
}

type BoardNavigationArgs = {
  router: RouterLike
  pathname: string
  projectLookup: Map<string, ProjectWithRelations>
  projectsByClientId: Map<string, ProjectWithRelations[]>
  clientSlugLookup: Map<string, string | null>
  setFeedback: Dispatch<SetStateAction<string | null>>
}

export const useBoardNavigation = ({
  router,
  pathname,
  projectLookup,
  projectsByClientId,
  clientSlugLookup,
  setFeedback,
}: BoardNavigationArgs) =>
  useCallback(
    (projectId: string | null, options: NavigateOptions = {}) => {
      const { taskId = null, replace = false, view = 'board' } = options

      if (!projectId) {
        if (pathname !== BOARD_BASE_PATH) {
          const redirect = replace ? router.replace : router.push
          redirect.call(router, BOARD_BASE_PATH, { scroll: false })
        }
        return
      }

      const path = buildBoardPath(
        projectId,
        {
          projectLookup,
          projectsByClientId,
          clientSlugLookup,
        },
        { taskId, view }
      )

      if (!path) {
        setFeedback((prev: string | null) =>
          prev === MISSING_SLUG_MESSAGE ? prev : MISSING_SLUG_MESSAGE
        )
        return
      }

      setFeedback((prev: string | null) =>
        prev === MISSING_SLUG_MESSAGE ? null : prev
      )

      if (pathname === path) {
        return
      }

      const redirect = replace ? router.replace : router.push
      redirect.call(router, path, { scroll: false })
    },
    [
      clientSlugLookup,
      pathname,
      projectLookup,
      projectsByClientId,
      router,
      setFeedback,
    ]
  )

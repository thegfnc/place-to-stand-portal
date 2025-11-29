import type { UIEventHandler } from 'react'

import { useScrollPersistence } from '@/hooks/use-scroll-persistence'

type UseBoardScrollPersistenceOptions = {
  activeProjectId: string | null
}

type UseBoardScrollPersistenceReturn = {
  boardViewportRef: React.MutableRefObject<HTMLDivElement | null>
  handleBoardScroll: UIEventHandler<HTMLDivElement>
}

export function useBoardScrollPersistence(
  options: UseBoardScrollPersistenceOptions
): UseBoardScrollPersistenceReturn {
  const { activeProjectId } = options
  const storageKey = activeProjectId
    ? `projects-board-scroll:${activeProjectId}`
    : null

  const { viewportRef, handleScroll } = useScrollPersistence({
    storageKey,
    axis: 'x',
  })

  return {
    boardViewportRef: viewportRef,
    handleBoardScroll: handleScroll,
  }
}

'use client'

import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'
import type { InteractionHandle } from '@/lib/perf/interaction-marks'

type StoredBoardInteraction = {
  handle: InteractionHandle
  from: string
  to: string
}

type GlobalWithBoardInteraction = typeof globalThis & {
  __ptsBoardTabInteraction?: StoredBoardInteraction
}

const BOARD_INTERACTION_KEY = '__ptsBoardTabInteraction'

function getGlobalStore(): GlobalWithBoardInteraction {
  return globalThis as GlobalWithBoardInteraction
}

export function startBoardTabInteraction(from: string, to: string) {
  if (typeof window === 'undefined' || from === to) {
    return
  }

  const store = getGlobalStore()

  const interaction = startClientInteraction(
    INTERACTION_EVENTS.BOARD_TAB_SWITCH,
    {
      metadata: {
        from,
        to,
      },
      baseProperties: {
        from,
        to,
      },
    }
  )

  store[BOARD_INTERACTION_KEY] = {
    handle: interaction,
    from,
    to,
  }
}

export function completeBoardTabInteraction(currentTab: string) {
  if (typeof window === 'undefined') {
    return
  }

  const store = getGlobalStore()
  const interaction = store[BOARD_INTERACTION_KEY]

  if (!interaction) {
    return
  }

  interaction.handle.end({
    status: currentTab === interaction.to ? 'success' : 'mismatch',
    from: interaction.from,
    to: interaction.to,
    activeTab: currentTab,
  })

  delete store[BOARD_INTERACTION_KEY]
}


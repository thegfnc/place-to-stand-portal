import { startClientInteraction } from '@/lib/posthog/client'
import type { InteractionHandle } from '@/lib/perf/interaction-marks'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'

const STORE_KEY = '__pts_board_tab_switch__'

type BoardTabSwitchContext = {
  handle: InteractionHandle
  fromView: string | null
  toView: string
  projectId: string | null
}

type WindowWithBoardTabSwitch = Window & {
  [STORE_KEY]?: BoardTabSwitchContext
}

function getWindow(): WindowWithBoardTabSwitch | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window as WindowWithBoardTabSwitch
}

export function beginBoardTabSwitch({
  fromView,
  toView,
  projectId,
}: {
  fromView: string | null
  toView: string
  projectId: string | null
}) {
  const win = getWindow()

  if (!win) {
    return
  }

  const handle = startClientInteraction(INTERACTION_EVENTS.BOARD_TAB_SWITCH, {
    metadata: {
      fromView,
      toView,
      projectId,
    },
    baseProperties: {
      fromView,
      toView,
      projectId,
    },
  })

  win[STORE_KEY] = {
    handle,
    fromView,
    toView,
    projectId,
  }
}

export function consumeBoardTabSwitch(
  toView: string | null
): BoardTabSwitchContext | null {
  const win = getWindow()

  if (!win) {
    return null
  }

  const context = win[STORE_KEY]

  if (!context) {
    return null
  }

  if (context.toView !== toView) {
    return null
  }

  delete win[STORE_KEY]

  return context
}


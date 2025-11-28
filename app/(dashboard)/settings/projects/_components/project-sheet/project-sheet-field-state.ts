import { PROJECT_SHEET_PENDING_REASON } from '@/lib/settings/projects/project-sheet-contractors'
import { PROJECT_SHEET_MISSING_CLIENT_REASON } from '@/lib/settings/projects/project-sheet-ui-state'

export type DisabledFieldState = {
  disabled: boolean
  reason: string | null
}

export type ProjectSheetFieldState = {
  name: DisabledFieldState
  type: DisabledFieldState
  slug: DisabledFieldState
  status: DisabledFieldState
  date: DisabledFieldState
  client: DisabledFieldState
}

const PROJECT_SHEET_CLIENT_TYPE_REASON =
  'Personal and internal projects do not require a client.'

export function createProjectSheetFieldState(args: {
  isPending: boolean
  hasClients: boolean
  requiresClientSelection: boolean
}): ProjectSheetFieldState {
  const { isPending, hasClients, requiresClientSelection } = args
  const pendingReason = isPending ? PROJECT_SHEET_PENDING_REASON : null

  const sharedPendingState: DisabledFieldState = {
    disabled: isPending,
    reason: pendingReason,
  }

  const clientField: DisabledFieldState = (() => {
    if (isPending) {
      return { disabled: true, reason: pendingReason }
    }

    if (!requiresClientSelection) {
      return {
        disabled: true,
        reason: PROJECT_SHEET_CLIENT_TYPE_REASON,
      }
    }

    if (!hasClients) {
      return {
        disabled: true,
        reason: PROJECT_SHEET_MISSING_CLIENT_REASON,
      }
    }

    return { disabled: false, reason: null }
  })()

  return {
    name: sharedPendingState,
    type: sharedPendingState,
    slug: sharedPendingState,
    status: sharedPendingState,
    date: sharedPendingState,
    client: clientField,
  }
}

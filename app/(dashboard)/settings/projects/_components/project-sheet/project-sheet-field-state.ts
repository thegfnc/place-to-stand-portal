import {
  PROJECT_SHEET_MISSING_CLIENT_REASON,
  PROJECT_SHEET_PENDING_REASON,
} from '@/lib/settings/projects/use-project-sheet-state'

export type DisabledFieldState = {
  disabled: boolean
  reason: string | null
}

export type ProjectSheetFieldState = {
  name: DisabledFieldState
  slug: DisabledFieldState
  status: DisabledFieldState
  date: DisabledFieldState
  client: DisabledFieldState
}

export function createProjectSheetFieldState(args: {
  isPending: boolean
  hasClients: boolean
}): ProjectSheetFieldState {
  const { isPending, hasClients } = args
  const pendingReason = isPending ? PROJECT_SHEET_PENDING_REASON : null

  const sharedPendingState: DisabledFieldState = {
    disabled: isPending,
    reason: pendingReason,
  }

  const clientField: DisabledFieldState = {
    disabled: isPending || !hasClients,
    reason: isPending
      ? pendingReason
      : !hasClients
        ? PROJECT_SHEET_MISSING_CLIENT_REASON
        : null,
  }

  return {
    name: sharedPendingState,
    slug: sharedPendingState,
    status: sharedPendingState,
    date: sharedPendingState,
    client: clientField,
  }
}

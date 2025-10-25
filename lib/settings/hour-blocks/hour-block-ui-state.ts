import type { HourBlockWithClient } from './hour-block-form'
import type { ClientOption } from './hour-block-options'

export type FieldState = {
  disabled: boolean
  reason: string | null
}

export type SubmitButtonState = {
  disabled: boolean
  reason: string | null
  label: string
}

export type DeleteButtonState = {
  disabled: boolean
  reason: string | null
}

export const PENDING_REASON = 'Please wait for the current request to finish.'
export const MISSING_CLIENT_REASON =
  'Create a client before logging hour blocks.'

const SUBMIT_LABELS = {
  creating: 'Create hour block',
  updating: 'Save changes',
  pending: 'Saving...',
} as const

export const deriveClientFieldState = (
  isPending: boolean,
  clientOptions: ClientOption[]
): FieldState => {
  const disabled = isPending || clientOptions.length === 0
  const reason = disabled
    ? isPending
      ? PENDING_REASON
      : clientOptions.length === 0
        ? MISSING_CLIENT_REASON
        : null
    : null

  return { disabled, reason }
}

export const deriveStandardFieldState = (isPending: boolean): FieldState => ({
  disabled: isPending,
  reason: isPending ? PENDING_REASON : null,
})

export const deriveSubmitButtonState = (
  isPending: boolean,
  isEditing: boolean,
  clientOptions: ClientOption[]
): SubmitButtonState => {
  const hasClients = clientOptions.length > 0 || isEditing
  const disabled = isPending || !hasClients
  let reason: string | null = null

  if (disabled) {
    reason = isPending
      ? PENDING_REASON
      : hasClients
        ? null
        : MISSING_CLIENT_REASON
  }

  let label: string = SUBMIT_LABELS.creating
  if (isPending) {
    label = SUBMIT_LABELS.pending
  } else if (isEditing) {
    label = SUBMIT_LABELS.updating
  }

  return { disabled, reason, label }
}

export const deriveDeleteButtonState = (
  isEditing: boolean,
  isPending: boolean,
  hourBlock: HourBlockWithClient | null
): DeleteButtonState => {
  if (!isEditing) {
    return { disabled: true, reason: null }
  }

  const disabled = isPending || Boolean(hourBlock?.deleted_at)
  const reason = disabled
    ? isPending
      ? PENDING_REASON
      : hourBlock?.deleted_at
        ? 'This hour block is already deleted.'
        : null
    : null

  return { disabled, reason }
}

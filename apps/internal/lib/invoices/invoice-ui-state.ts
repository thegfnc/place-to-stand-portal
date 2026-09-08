import type { InvoiceWithClient } from './invoice-form'
import type { ClientOption } from './invoice-options'
import { PENDING_REASON, getSubmitLabel } from '@/lib/forms/form-controls'

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



const MISSING_CLIENT_REASON =
  'Create a client before creating invoices.'
const NON_EDITABLE_REASON = 'This invoice cannot be edited.'

const NON_EDITABLE_STATUSES = new Set(['PAID', 'VOID'])

// ---------------------------------------------------------------------------
// Invoice editability
// ---------------------------------------------------------------------------

export function isInvoiceEditable(status: string | null): boolean {
  if (!status) return true // new invoice
  return !NON_EDITABLE_STATUSES.has(status)
}

// ---------------------------------------------------------------------------
// Field states
// ---------------------------------------------------------------------------

export const deriveClientFieldState = (
  isPending: boolean,
  clientOptions: ClientOption[],
  status: string | null
): FieldState => {
  if (!isInvoiceEditable(status)) {
    return { disabled: true, reason: NON_EDITABLE_REASON }
  }

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

export const deriveStandardFieldState = (
  isPending: boolean,
  status: string | null
): FieldState => {
  if (!isInvoiceEditable(status)) {
    return { disabled: true, reason: NON_EDITABLE_REASON }
  }

  return {
    disabled: isPending,
    reason: isPending ? PENDING_REASON : null,
  }
}

// ---------------------------------------------------------------------------
// Button states
// ---------------------------------------------------------------------------

/**
 * `isSaving` is the save itself; `isBusy` also covers the open-time fetch of
 * the invoice's line items. Both block submit, but only a real save may say
 * "Saving..." — a sheet that reads "Saving..." on open is lying about what
 * it's doing.
 */
export const deriveSubmitButtonState = (
  isSaving: boolean,
  isEditing: boolean,
  clientOptions: ClientOption[],
  status: string | null,
  isBusy: boolean = isSaving
): SubmitButtonState => {
  const isPending = isBusy
  if (!isInvoiceEditable(status)) {
    return {
      disabled: true,
      reason: NON_EDITABLE_REASON,
      label: getSubmitLabel({
        isSaving: false,
        isEditing: true,
        createLabel: 'Create invoice',
      }),
    }
  }

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

  const label = getSubmitLabel({
    isSaving,
    isEditing,
    createLabel: 'Create invoice',
  })

  return { disabled, reason, label }
}

export const deriveDeleteButtonState = (
  isEditing: boolean,
  isPending: boolean,
  invoice: InvoiceWithClient | null
): DeleteButtonState => {
  if (!isEditing) {
    return { disabled: true, reason: null }
  }

  const disabled = isPending || Boolean(invoice?.deleted_at)
  const reason = disabled
    ? isPending
      ? PENDING_REASON
      : invoice?.deleted_at
        ? 'This invoice is already deleted.'
        : null
    : null

  return { disabled, reason }
}

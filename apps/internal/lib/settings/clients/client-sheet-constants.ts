export { PENDING_REASON } from '@/lib/forms/form-controls'
export const ARCHIVE_CLIENT_DIALOG_TITLE = 'Archive client?'

export const ARCHIVE_CLIENT_CONFIRM_LABEL = 'Archive'

export const getArchiveClientDialogDescription = (name?: string) =>
  `${name ?? 'This client'} will be hidden from selectors and reporting.`

export const PENDING_REASON = 'Please wait for the current request to finish.'

export const NO_AVAILABLE_CLIENT_USERS_MESSAGE =
  'All client-role users are already assigned.'

export const CLIENT_MEMBERS_HELP_TEXT =
  "Assigned users can view this client's projects and billing."

export const ARCHIVE_CLIENT_DIALOG_TITLE = 'Archive client?'

export const ARCHIVE_CLIENT_CONFIRM_LABEL = 'Archive'

export const getArchiveClientDialogDescription = (name?: string) =>
  `${name ?? 'This client'} will be hidden from selectors and reporting.`

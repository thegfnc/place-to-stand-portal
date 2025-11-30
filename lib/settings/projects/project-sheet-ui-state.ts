import type { ClientRow, ProjectWithClient } from './project-sheet-form'
import { PROJECT_SHEET_PENDING_REASON } from './project-sheet-contractors'

export type SubmitButtonState = {
  disabled: boolean
  reason: string | null
  label: string
}

export type DeleteButtonState = {
  disabled: boolean
  reason: string | null
}

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
}

export const PROJECT_SHEET_MISSING_CLIENT_REASON =
  'Add a client before creating a project.'

export const buildClientOptions = (clients: ClientRow[]): ClientOption[] =>
  clients.map(client => ({
    value: client.id,
    label: client.deleted_at ? `${client.name} (Archived)` : client.name,
    keywords: client.deleted_at ? [client.name, 'archived'] : [client.name],
  }))

export const deriveSubmitButtonState = (
  isPending: boolean,
  isEditing: boolean,
  clientOptions: ClientOption[],
  requiresClientSelection: boolean
): SubmitButtonState => {
  const hasRequiredClients =
    !requiresClientSelection || clientOptions.length > 0 || isEditing
  const disabled = isPending || !hasRequiredClients
  let reason: string | null = null

  if (disabled) {
    reason = isPending
      ? PROJECT_SHEET_PENDING_REASON
      : requiresClientSelection && clientOptions.length === 0 && !isEditing
        ? PROJECT_SHEET_MISSING_CLIENT_REASON
        : null
  }

  let label = 'Create project'
  if (isPending) {
    label = 'Saving...'
  } else if (isEditing) {
    label = 'Save changes'
  }

  return { disabled, reason, label }
}

const PROJECT_SHEET_ARCHIVE_DISABLED_REASON =
  'Archiving disabled while editing another project.'

export const deriveDeleteButtonState = (
  isEditing: boolean,
  isPending: boolean,
  project: ProjectWithClient | null
): DeleteButtonState => {
  if (!isEditing) {
    return { disabled: true, reason: null }
  }

  const disabled = isPending || Boolean(project?.deleted_at)
  const reason = disabled
    ? isPending
      ? PROJECT_SHEET_PENDING_REASON
      : PROJECT_SHEET_ARCHIVE_DISABLED_REASON
    : null

  return { disabled, reason }
}

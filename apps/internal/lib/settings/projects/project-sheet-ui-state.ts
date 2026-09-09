import type React from 'react'
import { User } from 'lucide-react'

import type { ClientRow, ProjectWithClient } from './project-sheet-form'
import { PROJECT_SHEET_PENDING_REASON } from './project-sheet-contractors'
import { getSubmitLabel } from '@/lib/forms/form-controls'
import { isSelectableUser } from '@/lib/users/selectable'

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

export type OwnerOption = {
  value: string
  label: string
  keywords: string[]
  avatarUrl: string | null
  userId: string
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export type AdminUserForOwner = {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  /** Set when the admin can no longer sign in; kept for display only. */
  disabled_at?: string | null
}

const UNASSIGNED_OWNER_OPTION: OwnerOption = {
  value: '',
  label: 'Unassigned',
  keywords: ['unassigned', 'none', 'no owner'],
  avatarUrl: null,
  userId: '',
  icon: User,
}

const toOwnerOption = (admin: AdminUserForOwner): OwnerOption => ({
  value: admin.id,
  label: admin.full_name ?? admin.email,
  keywords: [admin.full_name ?? '', admin.email].filter(Boolean),
  avatarUrl: admin.avatar_url,
  userId: admin.id,
})

/**
 * Disabled admins are not offered, but a project they already own keeps
 * them as a disabled entry so the picker still names the current owner.
 */
export const buildOwnerOptions = (
  admins: AdminUserForOwner[],
  currentOwnerId: string | null = null
): OwnerOption[] => {
  const options = [
    UNASSIGNED_OWNER_OPTION,
    ...admins.filter(isSelectableUser).map(toOwnerOption),
  ]

  if (currentOwnerId && !options.some(option => option.value === currentOwnerId)) {
    const currentOwner = admins.find(admin => admin.id === currentOwnerId)
    if (currentOwner) {
      options.push({ ...toOwnerOption(currentOwner), disabled: true })
    }
  }

  return options
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

  const label = getSubmitLabel({
    isSaving: isPending,
    isEditing,
    createLabel: 'Create project',
  })

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

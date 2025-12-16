import { formatISO, parseISO } from 'date-fns'

import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { buildProjectSelectionOptions } from '@/lib/projects/project-selection-utils'

import {
  MANAGE_PERMISSION_REASON,
  PENDING_REASON,
  UNASSIGNED_ASSIGNEE_VALUE,
} from './task-sheet-constants'
import type { TaskSheetFormValues } from './task-sheet-schema'

type Member = ProjectWithRelations['members'][number]

type BuildAssigneeItemsArgs = {
  admins: DbUser[]
  members: ProjectWithRelations['members']
  currentAssigneeId: string | null
}

type CreateDefaultValuesArgs = {
  task: TaskWithRelations | undefined
  currentAssigneeId: string | null
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  defaultProjectId: string | null
  defaultAssigneeId: string | null
}

type BuildProjectItemsArgs = {
  projects: ProjectWithRelations[]
  currentUserId?: string
}

export type ProjectSelectionItems = {
  items: SearchableComboboxItem[]
  groups: SearchableComboboxGroup[]
}

const tidyRole = (role: string | null | undefined) => {
  if (!role) return null
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export const formatRoleLabel = (role: string | null | undefined) =>
  tidyRole(role) ?? 'Unknown role'

export const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return ''

  try {
    return formatISO(parseISO(value), { representation: 'date' })
  } catch (error) {
    console.warn('Invalid date for task form', { value, error })
    return ''
  }
}

export const normalizeRichTextContent = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const stripped = value
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (stripped.length === 0) {
    return null
  }

  return value
}

const getMemberDisplayName = (
  member: Member | undefined,
  admin: DbUser | undefined
) => {
  const memberName = member?.user.full_name?.trim()
  if (memberName) return memberName

  const adminName = admin?.full_name?.trim()
  if (adminName) return adminName

  return member?.user.email ?? admin?.email ?? 'Unknown collaborator'
}

const buildDescription = (
  member: Member | undefined,
  admin: DbUser | undefined
) => {
  const descriptionParts: string[] = []
  const userRole = member?.user.role ?? admin?.role ?? null
  const roleLabel = tidyRole(userRole)
  if (roleLabel) {
    descriptionParts.push(roleLabel)
  }

  const email = member?.user.email ?? admin?.email
  if (email) {
    descriptionParts.push(email)
  }

  return descriptionParts.join(' • ')
}

export const buildAssigneeItems = ({
  admins,
  members,
  currentAssigneeId,
}: BuildAssigneeItemsArgs): SearchableComboboxItem[] => {
  const seen = new Set<string>()
  const adminLookup = new Map<string, DbUser>()
  const eligibleItems: SearchableComboboxItem[] = []
  const fallbackItems: SearchableComboboxItem[] = []

  admins.forEach(admin => {
    if (!admin || admin.deleted_at) {
      return
    }

    adminLookup.set(admin.id, admin)

    if (seen.has(admin.id)) {
      return
    }

    const label = admin.full_name?.trim() || admin.email

    eligibleItems.push({
      value: admin.id,
      label,
      description: `${admin.email}`,
      keywords: [admin.email, 'admin'],
      userId: admin.id,
      avatarUrl: admin.avatar_url,
    })
    seen.add(admin.id)
  })

  members.forEach(member => {
    if (!member || seen.has(member.user_id)) {
      return
    }

    const user = member.user
    if (!user || user.deleted_at || user.role !== 'ADMIN') {
      return
    }

    const label = user.full_name?.trim() || user.email
    const descriptionParts = [tidyRole(user.role)]
    descriptionParts.push(user.email)

    eligibleItems.push({
      value: member.user_id,
      label,
      description: descriptionParts.join(' • '),
      keywords: [user.email, 'admin'].filter((keyword): keyword is string =>
        Boolean(keyword)
      ),
      userId: member.user_id,
      avatarUrl: user.avatar_url,
    })
    seen.add(member.user_id)
  })

  if (currentAssigneeId && !seen.has(currentAssigneeId)) {
    const currentMember = members.find(
      member => member.user_id === currentAssigneeId
    )
    const currentAdmin = adminLookup.get(currentAssigneeId)

    fallbackItems.push({
      value: currentAssigneeId,
      label: getMemberDisplayName(currentMember, currentAdmin),
      description: buildDescription(currentMember, currentAdmin),
      keywords: [
        currentMember?.user.email ?? currentAdmin?.email ?? 'unavailable',
      ],
      disabled: true,
      userId: currentAssigneeId,
      avatarUrl:
        currentMember?.user.avatar_url ?? currentAdmin?.avatar_url ?? null,
    })
  }

  eligibleItems.sort((a, b) => a.label.localeCompare(b.label))
  fallbackItems.sort((a, b) => a.label.localeCompare(b.label))

  return [
    {
      value: UNASSIGNED_ASSIGNEE_VALUE,
      label: 'Unassigned',
      description: 'No collaborator assigned yet.',
      keywords: ['unassigned'],
    },
    ...eligibleItems,
    ...fallbackItems,
  ]
}

export const buildProjectItems = ({
  projects,
  currentUserId,
}: BuildProjectItemsArgs): ProjectSelectionItems =>
  buildProjectSelectionOptions({ projects, currentUserId })

export const createDefaultValues = ({
  task,
  currentAssigneeId,
  defaultStatus,
  defaultDueOn,
  defaultProjectId,
  defaultAssigneeId,
}: CreateDefaultValuesArgs): TaskSheetFormValues => ({
  title: task?.title ?? '',
  description: task?.description ?? null,
  status: task?.status ?? defaultStatus,
  dueOn: toDateInputValue(task?.due_on ?? defaultDueOn ?? null),
  projectId: task?.project_id ?? defaultProjectId ?? '',
  assigneeId: currentAssigneeId ?? defaultAssigneeId ?? null,
})

export const getDisabledReason = (
  disabled: boolean,
  canManage: boolean,
  isPending: boolean
) => {
  if (!disabled) {
    return null
  }

  if (!canManage) {
    return MANAGE_PERMISSION_REASON
  }

  if (isPending) {
    return PENDING_REASON
  }

  return null
}

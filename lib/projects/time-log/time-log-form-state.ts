'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { buildAssigneeItems } from '@/lib/projects/task-sheet/task-sheet-utils'
import { UNASSIGNED_ASSIGNEE_VALUE } from '@/lib/projects/task-sheet/task-sheet-constants'
import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'

import type {
  ProjectTimeLogDialogParams,
  TimeLogFormErrors,
  TimeLogFormField,
} from './types'

export const FORM_ERROR_IDS = {
  hours: 'time-log-hours-error',
  loggedOn: 'time-log-date-error',
  user: 'time-log-user-error',
  general: 'time-log-general-error',
} as const

export type UseTimeLogFormStateOptions = {
  currentUserId: string
  canSelectUser: boolean
  admins: ProjectTimeLogDialogParams['admins']
  projectMembers: ProjectTimeLogDialogParams['projectMembers']
  getToday: () => string
}

export type UseTimeLogFormStateResult = {
  hoursInput: string
  onHoursChange: (value: string) => void
  loggedOnInput: string
  onLoggedOnChange: (value: string) => void
  noteInput: string
  onNoteChange: (value: string) => void
  selectedUserId: string
  onSelectUser: (value: string) => void
  formErrors: TimeLogFormErrors
  setFormErrors: React.Dispatch<React.SetStateAction<TimeLogFormErrors>>
  clearFieldErrors: (fields: TimeLogFormField[]) => void
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
    general?: string
  }
  userComboboxItems: SearchableComboboxItem[]
  prepareForOpen: (nextUserId: string) => void
  resetForClose: (nextUserId: string) => void
}

export function useTimeLogFormState(
  options: UseTimeLogFormStateOptions
): UseTimeLogFormStateResult {
  const { currentUserId, canSelectUser, admins, projectMembers, getToday } =
    options

  const [hoursInput, setHoursInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [loggedOnInput, setLoggedOnInput] = useState(() => getToday())
  const [selectedUserId, setSelectedUserId] = useState(currentUserId)
  const [formErrors, setFormErrors] = useState<TimeLogFormErrors>({})

  useEffect(() => {
    setSelectedUserId(currentUserId)
  }, [currentUserId])

  const clearFieldErrors = useCallback((fields: TimeLogFormField[]) => {
    setFormErrors(prev => {
      let updated = false
      const next: TimeLogFormErrors = { ...prev }

      for (const field of fields) {
        if (next[field]) {
          delete next[field]
          updated = true
        }
      }

      return updated ? next : prev
    })
  }, [])

  const onHoursChange = useCallback(
    (value: string) => {
      setHoursInput(value)
      clearFieldErrors(['hours', 'general'])
    },
    [clearFieldErrors]
  )

  const onLoggedOnChange = useCallback(
    (value: string) => {
      setLoggedOnInput(value)
      clearFieldErrors(['loggedOn', 'general'])
    },
    [clearFieldErrors]
  )

  const onNoteChange = useCallback((value: string) => {
    setNoteInput(value)
  }, [])

  const onSelectUser = useCallback(
    (value: string) => {
      setSelectedUserId(value)
      clearFieldErrors(['user', 'general'])
    },
    [clearFieldErrors]
  )

  const prepareForOpen = useCallback(
    (nextUserId: string) => {
      setLoggedOnInput(getToday())
      setSelectedUserId(nextUserId)
      setFormErrors({})
    },
    [getToday]
  )

  const resetForClose = useCallback(
    (nextUserId: string) => {
      setHoursInput('')
      setNoteInput('')
      prepareForOpen(nextUserId)
    },
    [prepareForOpen]
  )

  const userComboboxItems = useMemo<SearchableComboboxItem[]>(() => {
    if (!canSelectUser) {
      return []
    }

    return buildAssigneeItems({
      admins,
      members: projectMembers,
      currentAssigneeId: selectedUserId,
    }).filter(item => item.value !== UNASSIGNED_ASSIGNEE_VALUE)
  }, [admins, canSelectUser, projectMembers, selectedUserId])

  const fieldErrorIds = useMemo(() => {
    return {
      hours: formErrors.hours ? FORM_ERROR_IDS.hours : undefined,
      loggedOn: formErrors.loggedOn ? FORM_ERROR_IDS.loggedOn : undefined,
      user: formErrors.user ? FORM_ERROR_IDS.user : undefined,
      general: formErrors.general ? FORM_ERROR_IDS.general : undefined,
    }
  }, [formErrors])

  return {
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    formErrors,
    setFormErrors,
    clearFieldErrors,
    fieldErrorIds,
    userComboboxItems,
    prepareForOpen,
    resetForClose,
  }
}

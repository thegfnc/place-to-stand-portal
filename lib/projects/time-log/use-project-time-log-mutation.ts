'use client'

import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'

import { logClientActivity } from '@/lib/activity/client'
import { timeLogCreatedEvent } from '@/lib/activity/events'
import type { ToastOptions } from '@/components/ui/use-toast'
import type {
  FieldError,
  TimeLogFormErrors,
  TimeLogFormField,
} from './types'
import type { Json } from '@/lib/types/json'

const SUCCESS_TOAST: ToastOptions = {
  title: 'Time logged',
  description: 'Your hours are now included in the burndown.',
}

export type UseProjectTimeLogMutationOptions = {
  queryClient: QueryClient
  router: {
    refresh: () => void
  }
  toast: (options: ToastOptions) => void
  baseQueryKey: readonly unknown[]
  project: {
    id: string
    name: string
    clientId: string | null
  }
  currentUserId: string
  canSelectUser: boolean
  formValues: {
    hoursInput: string
    loggedOnInput: string
    noteInput: string
    selectedUserId: string
  }
  selectedTaskIds: string[]
  onSuccessReset: () => void
  onClose: () => void
  setFormErrors: Dispatch<SetStateAction<TimeLogFormErrors>>
  mode: 'create' | 'edit'
  timeLogId: string | null
  successToast?: ToastOptions
}

export function useProjectTimeLogMutation(
  options: UseProjectTimeLogMutationOptions
) {
  const {
    queryClient,
    router,
    toast,
    baseQueryKey,
    project,
    currentUserId,
    canSelectUser,
    formValues,
    selectedTaskIds,
    onSuccessReset,
    onClose,
    setFormErrors,
    mode,
    timeLogId,
    successToast,
  } = options

  return useMutation({
    mutationFn: async () => {
      const isEditMode = mode === 'edit'
      if (isEditMode && !timeLogId) {
        throw new Error('Missing time log identifier for update.')
      }

      const parsedHours = Number.parseFloat(formValues.hoursInput)

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        throw makeFieldError(
          'hours',
          'Enter a valid number of hours greater than zero.'
        )
      }

      const logUserId = canSelectUser
        ? formValues.selectedUserId
        : currentUserId

      if (!logUserId) {
        throw makeFieldError('user', 'Select a teammate before logging time.')
      }

      const trimmedNote = formValues.noteInput.trim()

      const payload = {
        userId: logUserId,
        hours: parsedHours,
        loggedOn: formValues.loggedOnInput,
        note: trimmedNote.length ? trimmedNote : null,
        taskIds: selectedTaskIds,
      }

      const endpoint = isEditMode
        ? `/api/projects/${project.id}/time-logs/${timeLogId}`
        : `/api/projects/${project.id}/time-logs`

      const response = await fetch(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      let result: unknown = null
      try {
        result = await response.json()
      } catch {
        // ignore JSON parse errors; handled below using status
      }

      if (!response.ok) {
        const errorResult =
          typeof result === 'object' && result && result !== null
            ? (result as { error?: unknown; fieldErrors?: Record<string, string> })
            : null

        const message =
          errorResult && 'error' in errorResult
            ? String(errorResult.error ?? '').trim()
            : ''

        const fieldErrors =
          errorResult && 'fieldErrors' in errorResult
            ? errorResult.fieldErrors
            : null

        // If we have field-level errors, create an error with all field errors attached
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const firstField = Object.keys(fieldErrors)[0] as TimeLogFormField
          const firstMessage = fieldErrors[firstField] ?? message ?? 'Invalid input.'

          // Attach all field errors to the error object
          const error = makeFieldError(firstField, firstMessage) as FieldError & {
            allFieldErrors?: TimeLogFormErrors
          }

          const allFieldErrors: TimeLogFormErrors = {}
          Object.entries(fieldErrors).forEach(([key, value]) => {
            const field = key as TimeLogFormField
            if (['hours', 'loggedOn', 'user', 'note', 'general'].includes(field)) {
              allFieldErrors[field] = value
            }
          })
          error.allFieldErrors = allFieldErrors

          throw error
        }

        throw new Error(message || 'Unable to log time.')
      }

      const resolvedTimeLogId =
        typeof result === 'object' && result && 'timeLogId' in result
          ? String((result as { timeLogId?: unknown }).timeLogId ?? '')
          : isEditMode
            ? timeLogId ?? ''
            : ''

      if (!resolvedTimeLogId) {
        throw new Error('Time log mutation did not return an identifier.')
      }

      if (!isEditMode) {
        const event = timeLogCreatedEvent({
          hours: parsedHours,
          projectName: project.name,
          linkedTaskCount: selectedTaskIds.length,
        })

        const metadata = {
          taskIds: selectedTaskIds,
          notePresent: Boolean(formValues.noteInput.trim()),
          loggedOn: formValues.loggedOnInput,
        }

        await logClientActivity(event, {
          actorId: logUserId,
          targetType: 'TIME_LOG',
          targetId: resolvedTimeLogId,
          targetProjectId: project.id,
          targetClientId: project.clientId ?? null,
          metadata: JSON.parse(JSON.stringify(metadata)) as Json,
        })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      onSuccessReset()
      onClose()
      toast(successToast ?? SUCCESS_TOAST)
      router.refresh()
    },
    onError: error => {
      console.error('Failed to log time', error)

      const fieldError = error as FieldError & {
        allFieldErrors?: TimeLogFormErrors
      }

      // If we have all field errors from the API, use those
      if (fieldError.allFieldErrors) {
        setFormErrors(fieldError.allFieldErrors)
        return
      }

      const field = fieldError?.field
      const message = resolveErrorMessage(error)

      if (field && field !== 'general') {
        setFormErrors({ [field]: message })
        return
      }

      setFormErrors({ general: message })
    },
  })
}

function makeFieldError(
  field: FieldError['field'],
  message: string
): FieldError {
  const error = new Error(message) as FieldError
  error.field = field
  return error
}

function resolveErrorMessage(error: unknown): string {
  const fallback = 'Please try again shortly.'

  if (error instanceof Error) {
    return error.message || fallback
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const message = (error as { message?: string }).message ?? ''
    return message.trim() ? message : fallback
  }

  return fallback
}

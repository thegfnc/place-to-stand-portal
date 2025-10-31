'use client'

import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dispatch, SetStateAction } from 'react'

import { logClientActivity } from '@/lib/activity/client'
import { timeLogCreatedEvent } from '@/lib/activity/events'
import type { ToastOptions } from '@/components/ui/use-toast'
import type { FieldError, TimeLogFormErrors } from './types'
import type { Database, Json } from '@/supabase/types/database'

const SUCCESS_TOAST: ToastOptions = {
  title: 'Time logged',
  description: 'Your hours are now included in the burndown.',
}

export type UseProjectTimeLogMutationOptions = {
  supabase: SupabaseClient<Database>
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
}

export function useProjectTimeLogMutation(
  options: UseProjectTimeLogMutationOptions
) {
  const {
    supabase,
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
  } = options

  return useMutation({
    mutationFn: async () => {
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

      const payload = {
        project_id: project.id,
        user_id: logUserId,
        hours: parsedHours,
        logged_on: formValues.loggedOnInput,
        note: formValues.noteInput.trim() ? formValues.noteInput.trim() : null,
      }

      const { data, error } = await supabase
        .from('time_logs')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      const timeLogId = data?.id ?? null

      if (!timeLogId) {
        throw new Error('Time log was created without an identifier.')
      }

      if (selectedTaskIds.length > 0) {
        const { error: linkError } = await supabase
          .from('time_log_tasks')
          .insert(
            selectedTaskIds.map(taskId => ({
              time_log_id: timeLogId,
              task_id: taskId,
            }))
          )

        if (linkError) {
          await supabase
            .from('time_logs')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', timeLogId)

          throw linkError
        }
      }

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
        targetId: timeLogId,
        targetProjectId: project.id,
        targetClientId: project.clientId ?? null,
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      onSuccessReset()
      onClose()
      toast(SUCCESS_TOAST)
      router.refresh()
    },
    onError: error => {
      console.error('Failed to log time', error)

      const field = (error as FieldError | null)?.field
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

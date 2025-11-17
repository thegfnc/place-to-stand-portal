'use client'

import { useMutation } from '@tanstack/react-query'

import { useToast } from '@/components/ui/use-toast'

import type { MyTaskStatus } from './my-tasks-constants'

export type MyTasksReorderPayload = {
  taskId: string
  targetStatus: MyTaskStatus
  targetOrder: string[]
  sourceStatus?: MyTaskStatus
  sourceOrder?: string[]
}

export function useMyTasksReorderMutation() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: MyTasksReorderPayload) => {
      const response = await fetch('/api/my-tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = (await safeJson(response)) as { error?: string } | null
        const message = data?.error ?? 'Unable to save your task ordering.'
        throw new Error(message)
      }
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Reorder failed',
        description: error.message,
      })
    },
  })
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}


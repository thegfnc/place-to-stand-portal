import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ProjectWithRelations } from '@/lib/types'

// Types matching the API response
export type EmailSuggestion = {
  id: string
  suggestedTitle: string
  suggestedDescription: string | null
  suggestedDueDate: string | null
  suggestedPriority: string | null
  confidence: string
  reasoning: string | null
  status: string
}

export type EmailWithSuggestions = {
  id: string
  subject: string | null
  snippet: string | null
  fromEmail: string
  fromName: string | null
  receivedAt: string | null
  suggestions: EmailSuggestion[]
}

type SuggestionsMeta = {
  totalEmails: number
  pendingSuggestions: number
  unanalyzedEmails: number
  hasGitHubRepos: boolean
  message?: string
}

type TaskStatus = 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

type UseAISuggestionsSheetArgs = {
  activeProject: ProjectWithRelations | null
  currentUserId: string
}

export function useAISuggestionsSheet({
  activeProject,
  currentUserId,
}: UseAISuggestionsSheetArgs) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [emails, setEmails] = useState<EmailWithSuggestions[]>([])
  const [meta, setMeta] = useState<SuggestionsMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch suggestions when sheet opens
  const fetchSuggestions = useCallback(async () => {
    if (!activeProject?.id) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/projects/${activeProject.id}/ai-suggestions?pendingOnly=true`
      )
      if (!res.ok) {
        throw new Error('Failed to fetch suggestions')
      }
      const data = await res.json()
      setEmails(data.emails || [])
      setMeta(data.meta || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [activeProject?.id])

  // Refresh when sheet opens
  useEffect(() => {
    if (isOpen && activeProject?.id) {
      fetchSuggestions()
    }
  }, [isOpen, activeProject?.id, fetchSuggestions])

  // Handle opening the sheet
  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  // Handle sheet open/close
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Clear error when closing
      setError(null)
    }
  }, [])

  // Analyze unanalyzed emails
  const handleAnalyzeEmails = useCallback(async () => {
    if (!activeProject?.id) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/projects/${activeProject.id}/ai-suggestions`,
        { method: 'POST' }
      )
      if (!res.ok) {
        throw new Error('Failed to analyze emails')
      }
      // Refresh the list after analysis
      await fetchSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze emails')
    } finally {
      setIsAnalyzing(false)
    }
  }, [activeProject?.id, fetchSuggestions])

  // Create task from suggestion
  const handleCreateTask = useCallback(
    async (suggestionId: string, status: TaskStatus) => {
      if (!activeProject?.id) return

      setIsCreatingTask(suggestionId)
      setError(null)

      try {
        const res = await fetch(
          `/api/projects/${activeProject.id}/ai-suggestions/create-task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestionId, status }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create task')
        }

        // Refresh to remove the processed suggestion
        await fetchSuggestions()
        // Refresh the board to show the new task
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task')
      } finally {
        setIsCreatingTask(null)
      }
    },
    [activeProject?.id, fetchSuggestions, router]
  )

  // Reject a suggestion
  const handleRejectSuggestion = useCallback(
    async (suggestionId: string, reason?: string) => {
      if (!activeProject?.id) return

      setIsCreatingTask(suggestionId)
      setError(null)

      try {
        const res = await fetch(
          `/api/projects/${activeProject.id}/ai-suggestions/create-task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', suggestionId, reason }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to reject suggestion')
        }

        // Refresh to remove the rejected suggestion
        await fetchSuggestions()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject suggestion')
      } finally {
        setIsCreatingTask(null)
      }
    },
    [activeProject?.id, fetchSuggestions]
  )

  // Computed values
  const pendingCount = meta?.pendingSuggestions ?? 0
  const unanalyzedCount = meta?.unanalyzedEmails ?? 0
  const hasGitHubRepos = meta?.hasGitHubRepos ?? false
  const disabled = !activeProject?.client_id
  const disabledReason = disabled ? 'Project has no client' : null

  return {
    // Sheet state
    isOpen,
    onOpen: handleOpen,
    onOpenChange: handleOpenChange,

    // Data
    emails,
    pendingCount,
    unanalyzedCount,
    hasGitHubRepos,

    // Loading states
    isLoading,
    isAnalyzing,
    isCreatingTask,
    error,

    // Actions
    onRefresh: fetchSuggestions,
    onAnalyzeEmails: handleAnalyzeEmails,
    onCreateTask: handleCreateTask,
    onRejectSuggestion: handleRejectSuggestion,

    // Disabled state
    disabled,
    disabledReason,
  }
}

export type UseAISuggestionsSheetReturn = ReturnType<typeof useAISuggestionsSheet>

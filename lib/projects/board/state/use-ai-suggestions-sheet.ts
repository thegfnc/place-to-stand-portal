import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ProjectWithRelations } from '@/lib/types'
import type { PRSuggestionWithContext } from '@/lib/types/github'

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

type GitHubRepoInfo = {
  id: string
  repoFullName: string
  defaultBranch: string
}

type CreatedTaskInfo = {
  taskId: string
  suggestionId: string
  title: string
  githubRepos: GitHubRepoInfo[]
}

type UseAISuggestionsSheetArgs = {
  activeProject: ProjectWithRelations | null
  currentUserId: string
}

export function useAISuggestionsSheet({
  activeProject,
  currentUserId: _currentUserId,
}: UseAISuggestionsSheetArgs) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [emails, setEmails] = useState<EmailWithSuggestions[]>([])
  const [meta, setMeta] = useState<SuggestionsMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // PR generation state
  const [createdTaskInfo, setCreatedTaskInfo] = useState<CreatedTaskInfo | null>(null)
  const [isGeneratingPR, setIsGeneratingPR] = useState(false)
  const [isApprovingPR, setIsApprovingPR] = useState(false)
  const [prSuggestion, setPRSuggestion] = useState<PRSuggestionWithContext | null>(null)

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

        const data = await res.json()

        // If project has GitHub repos, show PR generation prompt
        if (data.githubRepos && data.githubRepos.length > 0) {
          setCreatedTaskInfo({
            taskId: data.task.id,
            suggestionId: data.suggestionId,
            title: data.task.title,
            githubRepos: data.githubRepos,
          })
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

  // Generate PR suggestion from task
  const handleGeneratePR = useCallback(
    async (repoLinkId: string) => {
      if (!createdTaskInfo) return

      setIsGeneratingPR(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/suggestions/${createdTaskInfo.suggestionId}/generate-pr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoLinkId }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to generate PR suggestion')
        }

        const data = await res.json()
        setPRSuggestion(data.suggestion)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate PR')
      } finally {
        setIsGeneratingPR(false)
      }
    },
    [createdTaskInfo]
  )

  // Approve PR suggestion and create on GitHub
  const handleApprovePR = useCallback(
    async (modifications?: {
      title?: string
      body?: string
      branch?: string
      baseBranch?: string
      createNewBranch?: boolean
    }): Promise<{ prNumber: number; prUrl: string; branchCreated?: boolean } | null> => {
      if (!prSuggestion) return null

      setIsApprovingPR(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/pr-suggestions/${prSuggestion.id}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modifications || {}),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create PR')
        }

        const data = await res.json()

        // Clear PR flow state
        setCreatedTaskInfo(null)
        setPRSuggestion(null)

        return {
          prNumber: data.prNumber,
          prUrl: data.prUrl,
          branchCreated: data.branchCreated,
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create PR')
        return null
      } finally {
        setIsApprovingPR(false)
      }
    },
    [prSuggestion]
  )

  // Dismiss PR generation flow
  const handleDismissPR = useCallback(() => {
    setCreatedTaskInfo(null)
    setPRSuggestion(null)
    setError(null)
  }, [])

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

    // PR generation state
    createdTaskInfo,
    isGeneratingPR,
    isApprovingPR,
    prSuggestion,

    // PR generation actions
    onGeneratePR: handleGeneratePR,
    onApprovePR: handleApprovePR,
    onDismissPR: handleDismissPR,
  }
}

export type UseAISuggestionsSheetReturn = ReturnType<typeof useAISuggestionsSheet>

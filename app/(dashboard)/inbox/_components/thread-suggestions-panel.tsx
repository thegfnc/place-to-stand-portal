'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, Loader2, CheckCircle2, ListTodo, GitPullRequest, ExternalLink } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

type SuggestionSummary = {
  id: string
  type: 'TASK' | 'PR' | 'REPLY'
  status: string
  confidence: string
  title?: string
  createdAt: string
  projectName?: string | null
}

type ThreadSuggestionsPanelProps = {
  threadId: string
  isAdmin: boolean
}

export function ThreadSuggestionsPanel({ threadId, isAdmin }: ThreadSuggestionsPanelProps) {
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<SuggestionSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isApproving, setIsApproving] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return

    setIsLoading(true)
    fetch(`/api/threads/${threadId}/ai-suggestions`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setSuggestions(data.suggestions || [])
        }
      })
      .catch(err => {
        console.error('Failed to load suggestions:', err)
      })
      .finally(() => setIsLoading(false))
  }, [threadId, isAdmin])

  const handleApprove = async (suggestionId: string, type: 'TASK' | 'PR') => {
    setIsApproving(suggestionId)
    try {
      const endpoint = type === 'TASK'
        ? `/api/suggestions/${suggestionId}/approve`
        : `/api/pr-suggestions/${suggestionId}/approve`

      const res = await fetch(endpoint, { method: 'POST' })

      if (res.ok) {
        // Remove from list
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
        toast({
          title: type === 'TASK' ? 'Task created' : 'PR suggestion approved',
          description: type === 'TASK'
            ? 'The task has been added to the project.'
            : 'The PR suggestion has been approved.',
        })
      } else {
        throw new Error('Failed to approve')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to approve suggestion.',
        variant: 'destructive',
      })
    } finally {
      setIsApproving(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Lightbulb className='h-4 w-4 text-muted-foreground' />
        <span className='text-sm font-medium'>AI Suggestions</span>
      </div>

      {isLoading ? (
        <div className='flex items-center gap-2 rounded-lg border bg-muted/30 p-3'>
          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
          <span className='text-sm text-muted-foreground'>Loading suggestions...</span>
        </div>
      ) : suggestions.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No pending suggestions.</p>
      ) : (
        <div className='space-y-2'>
          {suggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className='rounded-lg border bg-muted/30 p-3 space-y-2'
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='flex items-center gap-2 min-w-0'>
                  {suggestion.type === 'TASK' ? (
                    <ListTodo className='h-4 w-4 text-blue-500 flex-shrink-0' />
                  ) : suggestion.type === 'PR' ? (
                    <GitPullRequest className='h-4 w-4 text-green-500 flex-shrink-0' />
                  ) : null}
                  <span className='text-sm font-medium truncate'>
                    {suggestion.title || 'Untitled'}
                  </span>
                </div>
                <Badge variant='secondary' className='text-xs flex-shrink-0'>
                  {Math.round(parseFloat(suggestion.confidence) * 100)}%
                </Badge>
              </div>

              {suggestion.projectName && (
                <p className='text-xs text-muted-foreground'>
                  Project: {suggestion.projectName}
                </p>
              )}

              <div className='flex items-center gap-2 pt-1'>
                <Button
                  size='sm'
                  variant='outline'
                  className='h-7 text-xs'
                  onClick={() => handleApprove(suggestion.id, suggestion.type as 'TASK' | 'PR')}
                  disabled={isApproving === suggestion.id}
                >
                  {isApproving === suggestion.id ? (
                    <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                  ) : (
                    <CheckCircle2 className='mr-1 h-3 w-3' />
                  )}
                  Approve
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 text-xs'
                  asChild
                >
                  <Link href='/suggestions'>
                    <ExternalLink className='mr-1 h-3 w-3' />
                    View All
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Github, GitPullRequest, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import type { PRSuggestionWithContext } from '@/lib/types/github'
import { PREditSheet } from './pr-edit-sheet'

interface PRSuggestionsPanelProps {
  initialSuggestions: PRSuggestionWithContext[]
}

export function PRSuggestionsPanel({ initialSuggestions }: PRSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [editingSuggestion, setEditingSuggestion] = useState<PRSuggestionWithContext | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const handleReject = async (suggestionId: string) => {
    setRejectingId(suggestionId)
    try {
      const res = await fetch(`/api/pr-suggestions/${suggestionId}/reject`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to reject')

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      toast({ title: 'PR suggestion rejected' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reject suggestion',
        variant: 'destructive',
      })
    } finally {
      setRejectingId(null)
    }
  }

  const handleApproved = (suggestionId: string, prUrl: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
    toast({
      title: 'PR Created!',
      description: `Pull request created successfully.`,
    })
    // Open PR in new tab
    window.open(prUrl, '_blank')
    setEditingSuggestion(null)
  }

  if (suggestions.length === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center'>
        <GitPullRequest className='mx-auto h-8 w-8 text-muted-foreground' />
        <p className='mt-2 text-sm text-muted-foreground'>
          No pending PR suggestions. Generate PR suggestions from emails or tasks.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {suggestions.map(suggestion => {
        const confidence = Number(suggestion.confidence)
        const confidenceColor =
          confidence >= 0.8
            ? 'text-green-600'
            : confidence >= 0.6
              ? 'text-amber-600'
              : 'text-red-600'

        return (
          <Card key={suggestion.id}>
            <CardHeader className='pb-2'>
              <div className='flex items-start justify-between'>
                <div className='space-y-1'>
                  <CardTitle className='text-base'>{suggestion.suggestedTitle}</CardTitle>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Github className='h-4 w-4' />
                    <span>{suggestion.repoLink.repoFullName}</span>
                    <span className='text-muted-foreground/50'>-&gt;</span>
                    <Badge variant='outline'>{suggestion.suggestedBaseBranch}</Badge>
                  </div>
                </div>
                <Badge variant='outline' className={confidenceColor}>
                  {Math.round(confidence * 100)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {suggestion.email && (
                <p className='mb-2 text-sm text-muted-foreground'>
                  From email: &quot;{suggestion.email.subject}&quot;
                </p>
              )}

              {suggestion.suggestedBranch && (
                <p className='mb-2 text-sm'>
                  <span className='text-muted-foreground'>Branch:</span>{' '}
                  <code className='rounded bg-muted px-1'>{suggestion.suggestedBranch}</code>
                </p>
              )}

              <div className='mb-4 max-h-40 overflow-auto rounded-md bg-muted p-3'>
                <pre className='whitespace-pre-wrap text-xs'>{suggestion.suggestedBody}</pre>
              </div>

              {suggestion.reasoning && (
                <p className='mb-4 text-xs italic text-muted-foreground'>
                  &quot;{suggestion.reasoning}&quot;
                </p>
              )}

              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleReject(suggestion.id)}
                  disabled={rejectingId === suggestion.id}
                >
                  {rejectingId === suggestion.id ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    'Reject'
                  )}
                </Button>
                <Button size='sm' onClick={() => setEditingSuggestion(suggestion)}>
                  Review & Create PR
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <PREditSheet
        suggestion={editingSuggestion}
        onClose={() => setEditingSuggestion(null)}
        onApproved={handleApproved}
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TaskSuggestionWithEmail } from '@/lib/types/suggestions'
import { SuggestionCard } from './suggestion-card'
import { SuggestionEditSheet } from './suggestion-edit-sheet'

interface SuggestionsPanelProps {
  initialSuggestions: TaskSuggestionWithEmail[]
  initialCounts: { pending: number; approved: number; rejected: number }
  projects: Array<{ id: string; name: string }>
}

export function SuggestionsPanel({
  initialSuggestions,
  initialCounts,
  projects,
}: SuggestionsPanelProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [counts, setCounts] = useState(initialCounts)
  const [selected, setSelected] = useState<string[]>([])
  const [editingSuggestion, setEditingSuggestion] = useState<TaskSuggestionWithEmail | null>(null)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleApprove = async (suggestion: TaskSuggestionWithEmail) => {
    setEditingSuggestion(suggestion)
  }

  const handleQuickApprove = async (suggestionId: string) => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }))
      showMessage('success', 'Task created successfully')
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to approve suggestion')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (suggestionId: string, reason?: string) => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) throw new Error('Failed to reject')

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({ ...prev, pending: prev.pending - 1, rejected: prev.rejected + 1 }))
      showMessage('success', 'Suggestion rejected')
    } catch {
      showMessage('error', 'Failed to reject suggestion')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selected.length === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/suggestions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, suggestionIds: selected }),
      })

      const result = await response.json()

      setSuggestions(prev => prev.filter(s => !selected.includes(s.id)))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - result.succeeded,
        [action === 'approve' ? 'approved' : 'rejected']:
          prev[action === 'approve' ? 'approved' : 'rejected'] + result.succeeded,
      }))
      setSelected([])

      showMessage(
        result.failed > 0 ? 'error' : 'success',
        `${result.succeeded} suggestions ${action}d${result.failed > 0 ? `, ${result.failed} failed` : ''}`
      )
      router.refresh()
    } catch {
      showMessage('error', 'Bulk action failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleEditComplete = (approved: boolean) => {
    if (approved && editingSuggestion) {
      setSuggestions(prev => prev.filter(s => s.id !== editingSuggestion.id))
      setCounts(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }))
      showMessage('success', 'Task created successfully')
      router.refresh()
    }
    setEditingSuggestion(null)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    setSelected(prev =>
      prev.length === suggestions.length ? [] : suggestions.map(s => s.id)
    )
  }

  return (
    <div className='space-y-4'>
      {/* Message Banner */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className='flex gap-4'>
        <Badge variant='outline' className='text-sm'>
          <Inbox className='mr-1 h-3 w-3' />
          {counts.pending} pending
        </Badge>
        <Badge variant='outline' className='text-sm text-green-600'>
          <CheckCircle2 className='mr-1 h-3 w-3' />
          {counts.approved} approved
        </Badge>
        <Badge variant='outline' className='text-sm text-red-600'>
          <XCircle className='mr-1 h-3 w-3' />
          {counts.rejected} rejected
        </Badge>
      </div>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className='flex items-center gap-2 p-3 bg-muted rounded-lg'>
          <span className='text-sm'>{selected.length} selected</span>
          <Button
            size='sm'
            onClick={() => handleBulkAction('approve')}
            disabled={processing}
          >
            Approve All
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => handleBulkAction('reject')}
            disabled={processing}
          >
            Reject All
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Suggestion List */}
      {suggestions.length === 0 ? (
        <div className='rounded-lg border border-dashed p-8 text-center'>
          <Sparkles className='mx-auto h-8 w-8 text-muted-foreground' />
          <p className='mt-2 text-sm text-muted-foreground'>
            No pending suggestions. Analyze more emails to generate task suggestions.
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Button variant='ghost' size='sm' onClick={toggleSelectAll}>
              {selected.length === suggestions.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          {suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              selected={selected.includes(suggestion.id)}
              onSelect={() => toggleSelect(suggestion.id)}
              onApprove={() => handleApprove(suggestion)}
              onQuickApprove={() => handleQuickApprove(suggestion.id)}
              onReject={(reason) => handleReject(suggestion.id, reason)}
              disabled={processing}
            />
          ))}
        </div>
      )}

      {/* Edit Sheet */}
      <SuggestionEditSheet
        suggestion={editingSuggestion}
        projects={projects}
        onClose={() => setEditingSuggestion(null)}
        onComplete={handleEditComplete}
      />
    </div>
  )
}

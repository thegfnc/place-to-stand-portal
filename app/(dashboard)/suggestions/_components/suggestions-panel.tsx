'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Sparkles,
  Mail,
  Calendar,
  FolderKanban,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import type {
  SuggestionWithContext,
  TaskSuggestedContent,
  PRSuggestedContent,
} from '@/lib/types/suggestions'

type SuggestionCounts = {
  pending: number
  approved: number
  rejected: number
  byType: {
    TASK: number
    PR: number
    REPLY: number
  }
}

type SuggestionsPanelProps = {
  initialSuggestions: SuggestionWithContext[]
  initialCounts: SuggestionCounts
  projects: Array<{ id: string; name: string }>
}

export function SuggestionsPanel({
  initialSuggestions,
  initialCounts,
  projects,
}: SuggestionsPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [counts, setCounts] = useState(initialCounts)
  const [selected, setSelected] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null)

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
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - 1,
        approved: prev.approved + 1,
      }))
      toast({
        title: 'Suggestion approved',
        description: 'Task created successfully.',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to approve suggestion',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (suggestionId: string) => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error('Failed to reject')

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1,
      }))
      toast({ title: 'Suggestion rejected' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reject suggestion',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setRejectDialogOpen(null)
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
          prev[action === 'approve' ? 'approved' : 'rejected'] +
          result.succeeded,
      }))
      setSelected([])

      toast({
        title: result.failed > 0 ? 'Partial success' : 'Success',
        description: `${result.succeeded} suggestions ${action}d${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      })
      router.refresh()
    } catch {
      toast({
        title: 'Error',
        description: 'Bulk action failed',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
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
    <>
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Suggestions</h1>
        <p className='text-muted-foreground text-sm'>
          Review AI-generated suggestions from client communications.
        </p>
      </AppShellHeader>

      <div className='space-y-4'>
        {/* Stats */}
        <div className='flex flex-wrap gap-4'>
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
          <div className='bg-muted flex items-center gap-2 rounded-lg p-3'>
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
            <Sparkles className='text-muted-foreground mx-auto h-8 w-8' />
            <p className='text-muted-foreground mt-2 text-sm'>
              No pending suggestions. Suggestions are generated when emails are
              analyzed on project boards.
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {suggestions.length > 1 && (
              <div className='flex items-center gap-2'>
                <Checkbox
                  checked={selected.length === suggestions.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className='text-muted-foreground text-sm'>
                  Select all
                </span>
              </div>
            )}
            {suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                selected={selected.includes(suggestion.id)}
                onSelect={() => toggleSelect(suggestion.id)}
                onQuickApprove={() => handleQuickApprove(suggestion.id)}
                onReject={() => setRejectDialogOpen(suggestion.id)}
                disabled={processing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <ConfirmDialog
        open={!!rejectDialogOpen}
        title='Reject suggestion?'
        description='This will reject the suggestion. This action cannot be undone.'
        confirmLabel='Reject'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={() => rejectDialogOpen && handleReject(rejectDialogOpen)}
        onCancel={() => setRejectDialogOpen(null)}
      />
    </>
  )
}

function SuggestionCard({
  suggestion,
  selected,
  onSelect,
  onQuickApprove,
  onReject,
  disabled,
}: {
  suggestion: SuggestionWithContext
  selected: boolean
  onSelect: () => void
  onQuickApprove: () => void
  onReject: () => void
  disabled?: boolean
}) {
  const content = suggestion.suggestedContent as
    | TaskSuggestedContent
    | PRSuggestedContent
  const title = 'title' in content ? content.title : 'Untitled'
  const description =
    'description' in content
      ? content.description
      : 'body' in content
        ? content.body
        : null

  const confidencePercent = Math.round(Number(suggestion.confidence) * 100)
  const confidenceColor =
    confidencePercent >= 80
      ? 'text-green-600'
      : confidencePercent >= 60
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <Card className={selected ? 'ring-primary ring-2' : ''}>
      <CardHeader className='pb-2'>
        <div className='flex items-start gap-3'>
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className='mt-1'
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className='text-xs'>
                {suggestion.type}
              </Badge>
              <CardTitle className='text-base font-medium'>{title}</CardTitle>
            </div>
            {suggestion.message && (
              <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm'>
                <span className='flex items-center gap-1'>
                  <Mail className='h-3 w-3' />
                  {suggestion.message.subject || '(no subject)'}
                </span>
                <span>·</span>
                <span>{suggestion.message.fromEmail}</span>
                {suggestion.message.sentAt && (
                  <>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(suggestion.message.sentAt))}{' '}
                      ago
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <Badge className={confidenceColor} variant='outline'>
            {confidencePercent}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='pt-0'>
        {description && (
          <p className='text-muted-foreground mb-3 line-clamp-2 text-sm'>
            {description}
          </p>
        )}

        <div className='mb-3 flex flex-wrap items-center gap-4 text-sm'>
          {suggestion.project && (
            <span className='flex items-center gap-1'>
              <FolderKanban className='h-3 w-3' />
              {suggestion.project.name}
            </span>
          )}
          {'dueDate' in content && content.dueDate && (
            <span className='flex items-center gap-1'>
              <Calendar className='h-3 w-3' />
              {content.dueDate}
            </span>
          )}
          {'priority' in content && content.priority && (
            <Badge variant='secondary' className='text-xs'>
              {content.priority}
            </Badge>
          )}
        </div>

        {suggestion.reasoning && (
          <p className='text-muted-foreground mb-3 text-xs italic'>
            &quot;{suggestion.reasoning}&quot;
          </p>
        )}

        <div className='flex items-center justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={onReject}
            disabled={disabled}
          >
            Reject
          </Button>
          <Button
            size='sm'
            onClick={onQuickApprove}
            disabled={disabled || !suggestion.projectId}
          >
            {disabled ? (
              <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            ) : null}
            {suggestion.type === 'TASK' ? 'Create Task' : 'Create PR'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

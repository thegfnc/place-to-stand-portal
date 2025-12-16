'use client'

import { useState } from 'react'
import { Mail, Calendar, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { TaskSuggestionWithEmail } from '@/lib/types/suggestions'
import { formatDistanceToNow } from 'date-fns'

interface SuggestionCardProps {
  suggestion: TaskSuggestionWithEmail
  selected: boolean
  onSelect: () => void
  onApprove: () => void
  onQuickApprove: () => void
  onReject: (reason?: string) => void
  disabled?: boolean
}

export function SuggestionCard({
  suggestion,
  selected,
  onSelect,
  onApprove,
  onQuickApprove,
  onReject,
  disabled,
}: SuggestionCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  const confidencePercent = Math.round(Number(suggestion.confidence) * 100)
  const confidenceColor =
    confidencePercent >= 80 ? 'text-green-600' :
    confidencePercent >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <>
      <Card className={selected ? 'ring-2 ring-primary' : ''}>
        <CardHeader className='pb-2'>
          <div className='flex items-start gap-3'>
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className='mt-1'
            />
            <div className='flex-1 min-w-0'>
              <CardTitle className='text-base font-medium'>
                {suggestion.suggestedTitle}
              </CardTitle>
              <div className='flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <Mail className='h-3 w-3' />
                  {suggestion.email.subject || '(no subject)'}
                </span>
                <span>·</span>
                <span>{suggestion.email.fromEmail}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(suggestion.email.receivedAt))} ago</span>
              </div>
            </div>
            <Badge className={confidenceColor} variant='outline'>
              {confidencePercent}% confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='pt-0'>
          {suggestion.suggestedDescription && (
            <p className='text-sm text-muted-foreground mb-3 line-clamp-2'>
              {suggestion.suggestedDescription}
            </p>
          )}

          <div className='flex items-center gap-4 text-sm mb-3'>
            {suggestion.project && (
              <span className='flex items-center gap-1'>
                <FolderKanban className='h-3 w-3' />
                {suggestion.project.name}
              </span>
            )}
            {suggestion.suggestedDueDate && (
              <span className='flex items-center gap-1'>
                <Calendar className='h-3 w-3' />
                {suggestion.suggestedDueDate}
              </span>
            )}
            {suggestion.suggestedPriority && (
              <Badge variant='secondary' className='text-xs'>
                {suggestion.suggestedPriority}
              </Badge>
            )}
          </div>

          {suggestion.reasoning && (
            <p className='text-xs text-muted-foreground italic mb-3'>
              &quot;{suggestion.reasoning}&quot;
            </p>
          )}

          <div className='flex items-center justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setRejectDialogOpen(true)}
              disabled={disabled}
            >
              Reject
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={onApprove}
              disabled={disabled}
            >
              Edit & Approve
            </Button>
            <Button
              size='sm'
              onClick={onQuickApprove}
              disabled={disabled || !suggestion.projectId}
            >
              Quick Approve
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={rejectDialogOpen}
        title='Reject suggestion?'
        description={`This will reject the suggestion "${suggestion.suggestedTitle}". This action cannot be undone.`}
        confirmLabel='Reject'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={() => {
          onReject()
          setRejectDialogOpen(false)
        }}
        onCancel={() => setRejectDialogOpen(false)}
      />
    </>
  )
}

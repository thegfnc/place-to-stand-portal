'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import type { EmailWithSuggestions } from '@/lib/projects/board/state/use-ai-suggestions-sheet'
import { SuggestionItem } from './suggestion-item'

type EmailSuggestionCardProps = {
  email: EmailWithSuggestions
  isCreatingTask: string | null
  onCreateTask: (suggestionId: string, status: 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE') => void
  onReject: (suggestionId: string, reason?: string) => void
}

export function EmailSuggestionCard({
  email,
  isCreatingTask,
  onCreateTask,
  onReject,
}: EmailSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const pendingSuggestions = email.suggestions.filter(s => s.status === 'PENDING')
  const hasSuggestions = pendingSuggestions.length > 0

  const receivedAgo = email.receivedAt
    ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
    : null

  const senderDisplay = email.fromName || email.fromEmail

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className='cursor-pointer p-4 hover:bg-muted/50'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex min-w-0 flex-1 items-start gap-3'>
                <div className='mt-0.5 shrink-0 rounded-full bg-blue-100 p-2 dark:bg-blue-500/10'>
                  <Mail className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {email.subject || '(no subject)'}
                  </p>
                  <div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
                    <span className='truncate'>From: {senderDisplay}</span>
                    {receivedAgo && (
                      <>
                        <span>•</span>
                        <span>{receivedAgo}</span>
                      </>
                    )}
                  </div>
                  {email.snippet && (
                    <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
                      {email.snippet}
                    </p>
                  )}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                {hasSuggestions && (
                  <span className='rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'>
                    {pendingSuggestions.length} task{pendingSuggestions.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Button variant='ghost' size='icon' className='h-6 w-6'>
                  {isExpanded ? (
                    <ChevronUp className='h-4 w-4' />
                  ) : (
                    <ChevronDown className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className='border-t px-4 pb-4 pt-3'>
            {hasSuggestions ? (
              <div className='space-y-3'>
                {pendingSuggestions.map(suggestion => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    isCreating={isCreatingTask === suggestion.id}
                    onCreateTask={(status) => onCreateTask(suggestion.id, status)}
                    onReject={(reason) => onReject(suggestion.id, reason)}
                  />
                ))}
              </div>
            ) : (
              <p className='text-center text-sm text-muted-foreground'>
                No pending suggestions for this email
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { EmailSuggestion } from '@/lib/projects/board/state/use-ai-suggestions-sheet'

type TaskStatus = 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

type SuggestionItemProps = {
  suggestion: EmailSuggestion
  isCreating: boolean
  onCreateTask: (status: TaskStatus) => void
  onReject: (reason?: string) => void
}

const COLUMN_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'BACKLOG', label: 'Backlog', color: 'bg-slate-500' },
  { value: 'ON_DECK', label: 'On Deck', color: 'bg-yellow-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
  { value: 'DONE', label: 'Done', color: 'bg-green-500' },
]

function getConfidenceColor(confidence: string): string {
  const value = parseFloat(confidence)
  if (value >= 0.8) return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
  if (value >= 0.6) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
}

function formatConfidence(confidence: string): string {
  const value = parseFloat(confidence)
  return `${Math.round(value * 100)}%`
}

export function SuggestionItem({
  suggestion,
  isCreating,
  onCreateTask,
  onReject,
}: SuggestionItemProps) {
  const [selectedColumn, setSelectedColumn] = useState<TaskStatus>('BACKLOG')

  const handleCreateTask = () => {
    onCreateTask(selectedColumn)
  }

  const selectedOption = COLUMN_OPTIONS.find(o => o.value === selectedColumn)

  return (
    <div className='rounded-lg border bg-muted/30 p-3 overflow-visible'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h4 className='font-medium text-sm'>{suggestion.suggestedTitle}</h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant='secondary' className={getConfidenceColor(suggestion.confidence)}>
                    {formatConfidence(suggestion.confidence)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className='text-xs'>AI confidence score</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {suggestion.suggestedDescription && (
            <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
              {suggestion.suggestedDescription}
            </p>
          )}
          {suggestion.reasoning && (
            <p className='mt-2 text-xs italic text-muted-foreground/80'>
              &ldquo;{suggestion.reasoning}&rdquo;
            </p>
          )}
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            {suggestion.suggestedDueDate && (
              <Badge variant='outline' className='text-xs'>
                Due: {suggestion.suggestedDueDate}
              </Badge>
            )}
            {suggestion.suggestedPriority && (
              <Badge
                variant='outline'
                className={`text-xs ${
                  suggestion.suggestedPriority === 'HIGH'
                    ? 'border-red-300 text-red-600'
                    : suggestion.suggestedPriority === 'MEDIUM'
                      ? 'border-amber-300 text-amber-600'
                      : 'border-slate-300 text-slate-600'
                }`}
              >
                {suggestion.suggestedPriority}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className='mt-3 border-t pt-3'>
        <div className='flex items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm' disabled={isCreating}>
                <span
                  className={`mr-2 h-2 w-2 rounded-full ${selectedOption?.color}`}
                />
                {selectedOption?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              {COLUMN_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSelectedColumn(option.value)}
                >
                  <span className={`mr-2 h-2 w-2 rounded-full ${option.color}`} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size='sm' onClick={handleCreateTask} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                Creating...
              </>
            ) : (
              <>
                <Check className='mr-1 h-4 w-4' />
                Create Task
              </>
            )}
          </Button>

          <Button
            variant='ghost'
            size='sm'
            onClick={() => onReject()}
            disabled={isCreating}
            className='ml-auto text-muted-foreground hover:text-destructive'
          >
            <X className='mr-1 h-4 w-4' />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

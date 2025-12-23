import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type BoardHeaderItem = SearchableComboboxItem
export type BoardHeaderItemGroup = SearchableComboboxGroup

type ProjectsBoardHeaderProps = {
  projectItems: BoardHeaderItem[]
  projectGroups?: BoardHeaderItemGroup[]
  selectedProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  onSelectNextProject: () => void
  onSelectPreviousProject: () => void
  canSelectNext: boolean
  canSelectPrevious: boolean
  // AI Suggestions
  onOpenAISuggestions?: () => void
  aiSuggestionsCount?: number
  aiSuggestionsDisabled?: boolean
  aiSuggestionsDisabledReason?: string | null
}

export function ProjectsBoardHeader({
  projectItems,
  projectGroups,
  selectedProjectId,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNext,
  canSelectPrevious,
  onOpenAISuggestions,
  aiSuggestionsCount = 0,
  aiSuggestionsDisabled = false,
  aiSuggestionsDisabledReason,
}: ProjectsBoardHeaderProps) {
  const aiButton = (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={onOpenAISuggestions}
      disabled={aiSuggestionsDisabled || !onOpenAISuggestions}
      className='gap-2'
    >
      <Sparkles className='h-4 w-4 text-amber-500' />
      <span className='hidden sm:inline'>AI Suggestions</span>
      {aiSuggestionsCount > 0 && (
        <Badge
          variant='secondary'
          className='ml-1 bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
        >
          {aiSuggestionsCount}
        </Badge>
      )}
    </Button>
  )

  return (
    <div className='flex w-full flex-wrap items-center gap-3'>
      <div className='flex flex-1 items-center gap-3'>
        <div className='min-w-[400px] space-y-2'>
          <Label htmlFor='projects-project-select' className='sr-only'>
            Project Selector
          </Label>
          <SearchableCombobox
            id='projects-project-select'
            items={projectItems}
            groups={projectGroups}
            value={selectedProjectId ?? ''}
            onChange={value => onProjectChange(value || null)}
            placeholder='Select a project...'
            searchPlaceholder='Search clients or projects...'
            disabled={projectItems.length === 0}
            ariaLabel='Select a project'
            variant='heading'
          />
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={onSelectPreviousProject}
            disabled={!canSelectPrevious}
            aria-label='Select previous project'
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={onSelectNextProject}
            disabled={!canSelectNext}
            aria-label='Select next project'
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
        {onOpenAISuggestions && (
          <div className='ml-2'>
            {aiSuggestionsDisabledReason ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>{aiButton}</TooltipTrigger>
                  <TooltipContent>
                    <p>{aiSuggestionsDisabledReason}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              aiButton
            )}
          </div>
        )}
      </div>
    </div>
  )
}

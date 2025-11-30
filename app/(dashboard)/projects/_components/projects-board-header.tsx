import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

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
}: ProjectsBoardHeaderProps) {
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
      </div>
    </div>
  )
}

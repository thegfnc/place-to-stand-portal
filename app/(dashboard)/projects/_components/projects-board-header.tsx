import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'

export type BoardHeaderItem = {
  value: string
  label: string
  keywords: string[]
}

type ProjectsBoardHeaderProps = {
  clientItems: BoardHeaderItem[]
  projectItems: BoardHeaderItem[]
  selectedClientId: string | null
  selectedProjectId: string | null
  onClientChange: (clientId: string) => void
  onProjectChange: (projectId: string | null) => void
  onSelectNextProject: () => void
  onSelectPreviousProject: () => void
  canSelectNext: boolean
  canSelectPrevious: boolean
}

export function ProjectsBoardHeader({
  clientItems,
  projectItems,
  selectedClientId,
  selectedProjectId,
  onClientChange,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNext,
  canSelectPrevious,
}: ProjectsBoardHeaderProps) {
  return (
    <div className='flex w-full flex-wrap items-end gap-3'>
      <div className='min-w-[200px] space-y-1'>
        <Label htmlFor='projects-client-select'>Client</Label>
        <SearchableCombobox
          id='projects-client-select'
          items={clientItems}
          value={selectedClientId ?? ''}
          onChange={value => onClientChange(value)}
          placeholder='Select client'
          searchPlaceholder='Search clients...'
          disabled={clientItems.length === 0}
          ariaLabel='Select client'
        />
      </div>
      <div className='flex items-end gap-3'>
        <div className='min-w-60 space-y-1'>
          <Label htmlFor='projects-project-select'>Project</Label>
          <SearchableCombobox
            id='projects-project-select'
            items={projectItems}
            value={selectedProjectId ?? ''}
            onChange={value => onProjectChange(value || null)}
            placeholder='Select project'
            searchPlaceholder='Search projects...'
            disabled={projectItems.length === 0}
            ariaLabel='Select project'
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

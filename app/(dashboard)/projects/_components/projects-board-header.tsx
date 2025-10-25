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
}

export function ProjectsBoardHeader({
  clientItems,
  projectItems,
  selectedClientId,
  selectedProjectId,
  onClientChange,
  onProjectChange,
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
    </div>
  )
}

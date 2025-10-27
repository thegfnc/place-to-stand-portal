import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type ProjectsBoardIntroProps = {
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  onAddTask: () => void
  isClientView: boolean
}

export function ProjectsBoardIntro({
  addTaskDisabled,
  addTaskDisabledReason,
  onAddTask,
  isClientView,
}: ProjectsBoardIntroProps) {
  if (isClientView) {
    return null
  }

  return (
    <div className='ml-auto flex items-center gap-2'>
      <DisabledFieldTooltip
        disabled={addTaskDisabled}
        reason={addTaskDisabledReason}
      >
        <Button
          onClick={onAddTask}
          disabled={addTaskDisabled}
          className='flex items-center gap-2'
        >
          <Plus className='h-4 w-4' /> Add task
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}

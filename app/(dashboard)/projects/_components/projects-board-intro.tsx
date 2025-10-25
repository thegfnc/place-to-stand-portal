import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type ProjectsBoardIntroProps = {
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  onAddTask: () => void
}

export function ProjectsBoardIntro({
  addTaskDisabled,
  addTaskDisabledReason,
  onAddTask,
}: ProjectsBoardIntroProps) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-4'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Project board</h1>
        <p className='text-muted-foreground text-sm'>
          Drag tasks between columns to update status. Filters respect your
          project assignments.
        </p>
      </div>
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

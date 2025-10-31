import Link from 'next/link'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ProjectsBoardTabsHeaderProps = {
  initialTab: 'board' | 'backlog' | 'activity'
  boardHref: string
  backlogHref: string
  activityHref: string
  backlogDisabled: boolean
  activityDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
}

export function ProjectsBoardTabsHeader(props: ProjectsBoardTabsHeaderProps) {
  const {
    initialTab,
    boardHref,
    backlogHref,
    activityHref,
    backlogDisabled,
    activityDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
  } = props

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
        <TabsTrigger value='board' className='px-3 py-1.5 text-sm' asChild>
          <Link href={boardHref} prefetch={false}>
            Board
          </Link>
        </TabsTrigger>
        <TabsTrigger
          value='backlog'
          className='px-3 py-1.5 text-sm'
          asChild
          disabled={backlogDisabled}
        >
          <Link
            href={backlogHref}
            prefetch={false}
            aria-disabled={backlogDisabled}
            tabIndex={backlogDisabled ? -1 : undefined}
            onClick={event => {
              if (backlogDisabled) {
                event.preventDefault()
              }
            }}
            className={
              backlogDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Backlog
          </Link>
        </TabsTrigger>
        <TabsTrigger
          value='activity'
          className='px-3 py-1.5 text-sm'
          asChild
          disabled={activityDisabled}
        >
          <Link
            href={activityHref}
            prefetch={false}
            aria-disabled={activityDisabled}
            tabIndex={activityDisabled ? -1 : undefined}
            onClick={event => {
              if (activityDisabled) {
                event.preventDefault()
              }
            }}
            className={
              activityDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Activity
          </Link>
        </TabsTrigger>
      </TabsList>
      {initialTab === 'board' ? (
        <div className='bg-background/80 flex w-full justify-end rounded-md border p-2 sm:w-auto'>
          <Label
            htmlFor='projects-board-assigned-filter'
            className='text-muted-foreground cursor-pointer'
          >
            <Checkbox
              id='projects-board-assigned-filter'
              checked={onlyAssignedToMe}
              onCheckedChange={value => onAssignedFilterChange(value === true)}
              className='h-4 w-4'
            />
            <span>Only show tasks assigned to me</span>
          </Label>
        </div>
      ) : null}
    </div>
  )
}

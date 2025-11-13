import Link from 'next/link'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { startBoardTabInteraction } from '@/lib/projects/board/board-tab-interaction'

export type ProjectsBoardTabsHeaderProps = {
  initialTab: 'board' | 'calendar' | 'backlog' | 'activity' | 'review'
  boardHref: string
  calendarHref: string
  backlogHref: string
  activityHref: string
  reviewHref: string
  calendarDisabled: boolean
  backlogDisabled: boolean
  activityDisabled: boolean
  reviewDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
}

export function ProjectsBoardTabsHeader(props: ProjectsBoardTabsHeaderProps) {
  const {
    initialTab,
    boardHref,
    calendarHref,
    backlogHref,
    activityHref,
    reviewHref,
    calendarDisabled,
    backlogDisabled,
    activityDisabled,
    reviewDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
  } = props

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
        <TabsTrigger value='board' className='px-3 py-1.5 text-sm' asChild>
          <Link
            href={boardHref}
            prefetch={false}
            onClick={() => startBoardTabInteraction(initialTab, 'board')}
          >
            Board
          </Link>
        </TabsTrigger>
        <TabsTrigger
          value='calendar'
          className='px-3 py-1.5 text-sm'
          asChild
          disabled={calendarDisabled}
        >
          <Link
            href={calendarHref}
            prefetch={false}
            aria-disabled={calendarDisabled}
            tabIndex={calendarDisabled ? -1 : undefined}
            onClick={event => {
              if (calendarDisabled) {
                event.preventDefault()
                return
              }
              startBoardTabInteraction(initialTab, 'calendar')
            }}
            className={
              calendarDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Calendar
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
                return
              }
              startBoardTabInteraction(initialTab, 'backlog')
            }}
            className={
              backlogDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Backlog
          </Link>
        </TabsTrigger>
        <TabsTrigger
          value='review'
          className='px-3 py-1.5 text-sm'
          asChild
          disabled={reviewDisabled}
        >
          <Link
            href={reviewHref}
            prefetch={false}
            aria-disabled={reviewDisabled}
            tabIndex={reviewDisabled ? -1 : undefined}
            onClick={event => {
              if (reviewDisabled) {
                event.preventDefault()
                return
              }
              startBoardTabInteraction(initialTab, 'review')
            }}
            className={
              reviewDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Review
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
                return
              }
              startBoardTabInteraction(initialTab, 'activity')
            }}
            className={
              activityDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Activity
          </Link>
        </TabsTrigger>
      </TabsList>
      {initialTab === 'board' || initialTab === 'calendar' ? (
        <Label
          htmlFor='projects-board-assigned-filter'
          className='text-muted-foreground bg-background/80 flex w-full cursor-pointer justify-end rounded-md border p-2 sm:w-auto'
        >
          <Checkbox
            id='projects-board-assigned-filter'
            checked={onlyAssignedToMe}
            onCheckedChange={value => onAssignedFilterChange(value === true)}
            className='h-4 w-4'
          />
          <span>Only show tasks assigned to me</span>
        </Label>
      ) : null}
    </div>
  )
}

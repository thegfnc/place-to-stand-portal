import Link from 'next/link'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ProjectsBoardTabsHeaderProps = {
  initialTab: 'board' | 'refine' | 'activity' | 'review'
  boardHref: string
  refineHref: string
  activityHref: string
  reviewHref: string
  refineDisabled: boolean
  activityDisabled: boolean
  reviewDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
}

export function ProjectsBoardTabsHeader(props: ProjectsBoardTabsHeaderProps) {
  const {
    initialTab,
    boardHref,
    refineHref,
    activityHref,
    reviewHref,
    refineDisabled,
    activityDisabled,
    reviewDisabled,
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
          value='refine'
          className='px-3 py-1.5 text-sm'
          asChild
          disabled={refineDisabled}
        >
          <Link
            href={refineHref}
            prefetch={false}
            aria-disabled={refineDisabled}
            tabIndex={refineDisabled ? -1 : undefined}
            onClick={event => {
              if (refineDisabled) {
                event.preventDefault()
              }
            }}
            className={
              refineDisabled ? 'pointer-events-none opacity-50' : undefined
            }
          >
            Refine
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
              }
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

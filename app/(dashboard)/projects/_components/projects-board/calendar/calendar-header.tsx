'use client'

import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

type CalendarHeaderProps = {
  currentMonth: Date
  monthValue: string
  yearValue: string
  onSelectMonth: (value: string) => void
  onYearChange: (value: string) => void
  onYearCommit: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onGoToToday: () => void
}

const monthLabels = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2025, index, 1)
  return {
    value: String(index),
    label: format(date, 'MMMM'),
  }
})

export function CalendarHeader({
  currentMonth,
  monthValue,
  yearValue,
  onSelectMonth,
  onYearChange,
  onYearCommit,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}: CalendarHeaderProps) {
  return (
    <div className='bg-card sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl px-4 py-3 shadow-sm'>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-lg font-semibold'>
            {format(currentMonth, 'MMMM yyyy')}
          </p>
        </div>
      </div>
      <div className='flex grow items-center justify-end gap-4'>
        <Button type='button' variant='outline' onClick={onGoToToday}>
          Today
        </Button>
        <div className='flex items-center gap-2'>
          <Select value={monthValue} onValueChange={onSelectMonth}>
            <SelectTrigger className='w-32'>
              <SelectValue aria-label='Select month' />
            </SelectTrigger>
            <SelectContent>
              {monthLabels.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form
            onSubmit={event => {
              event.preventDefault()
              onYearCommit()
            }}
          >
            <Input
              value={yearValue}
              onChange={event => onYearChange(event.target.value)}
              onBlur={onYearCommit}
              inputMode='numeric'
              className='w-24'
              aria-label='Select year'
            />
          </form>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            onClick={onPrevMonth}
            aria-label='View previous month'
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            onClick={onNextMonth}
            aria-label='View next month'
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

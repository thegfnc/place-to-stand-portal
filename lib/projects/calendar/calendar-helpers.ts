import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isWeekend,
  startOfWeek,
} from 'date-fns'

export type CalendarRange = {
  start: Date
  end: Date
}

export type CalendarDay = {
  date: Date
  key: string
  label: string
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

export type CalendarWeekdayHeader = {
  label: string
  isWeekend: boolean
}

export const getCalendarRange = (monthStart: Date): CalendarRange => {
  const start = startOfWeek(monthStart, { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 })
  return { start, end }
}

export const buildCalendarDays = (
  rangeStart: Date,
  rangeEnd: Date,
  visibleMonth: Date,
  todayKey: string
): CalendarDay[] => {
  const days: CalendarDay[] = []

  eachDayOfInterval({ start: rangeStart, end: rangeEnd }).forEach(date => {
    const key = format(date, 'yyyy-MM-dd')
    days.push({
      date,
      key,
      label: format(date, 'd'),
      isCurrentMonth: isSameMonth(date, visibleMonth),
      isToday: key === todayKey,
      isWeekend: isWeekend(date),
    })
  })

  return days
}

export const buildWeekdayHeaders = (
  rangeStart: Date
): CalendarWeekdayHeader[] => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(rangeStart, index)
    return {
      label: format(date, 'EEE'),
      isWeekend: isWeekend(date),
    }
  })
}

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { addMonths, getMonth, getYear, startOfMonth } from 'date-fns'

type UseCalendarNavigationOptions = {
  baseMonth: Date
  onMonthChange?: (month: Date) => void
}

type UseCalendarNavigationResult = {
  currentMonth: Date
  monthValue: string
  yearValue: string
  setYearValue: Dispatch<SetStateAction<string>>
  selectMonth: (value: string) => void
  commitYearChange: () => void
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToMonth: (month: Date) => void
}

export function useCalendarNavigation({
  baseMonth,
  onMonthChange,
}: UseCalendarNavigationOptions): UseCalendarNavigationResult {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(baseMonth)
  )
  const [monthValue, setMonthValue] = useState(() =>
    String(getMonth(baseMonth))
  )
  const [yearValue, setYearValue] = useState(() => String(getYear(baseMonth)))

  useEffect(() => {
    setMonthValue(String(getMonth(currentMonth)))
    setYearValue(String(getYear(currentMonth)))
  }, [currentMonth])

  const notifyChange = useCallback(
    (nextMonth: Date) => {
      setCurrentMonth(nextMonth)
      onMonthChange?.(nextMonth)
    },
    [onMonthChange]
  )

  const selectMonth = useCallback(
    (value: string) => {
      setMonthValue(value)
      const monthNumber = Number.parseInt(value, 10)

      if (Number.isNaN(monthNumber)) {
        return
      }

      const parsedYear = Number.parseInt(yearValue, 10)
      const yearNumber = Number.isNaN(parsedYear)
        ? getYear(currentMonth)
        : parsedYear

      const nextMonth = startOfMonth(new Date(yearNumber, monthNumber, 1))
      notifyChange(nextMonth)
    },
    [currentMonth, notifyChange, yearValue]
  )

  const commitYearChange = useCallback(() => {
    const parsedYear = Number.parseInt(yearValue, 10)

    if (Number.isNaN(parsedYear)) {
      setYearValue(String(getYear(currentMonth)))
      return
    }

    const nextMonth = startOfMonth(
      new Date(parsedYear, getMonth(currentMonth), 1)
    )
    notifyChange(nextMonth)
  }, [currentMonth, notifyChange, yearValue])

  const goToPrevMonth = useCallback(() => {
    notifyChange(startOfMonth(addMonths(currentMonth, -1)))
  }, [currentMonth, notifyChange])

  const goToNextMonth = useCallback(() => {
    notifyChange(startOfMonth(addMonths(currentMonth, 1)))
  }, [currentMonth, notifyChange])

  const goToMonth = useCallback(
    (month: Date) => {
      notifyChange(startOfMonth(month))
    },
    [notifyChange]
  )

  return {
    currentMonth,
    monthValue,
    yearValue,
    setYearValue,
    selectMonth,
    commitYearChange,
    goToPrevMonth,
    goToNextMonth,
    goToMonth,
  }
}

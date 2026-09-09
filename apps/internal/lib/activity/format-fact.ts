import type { ActivityFact } from './changes'
import { formatHours } from './events/shared'
import { formatCalendarDate } from '@/lib/dates'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatFact(fact: ActivityFact): string {
  switch (fact.kind) {
    case 'money': {
      const amount = Number(fact.value)
      return Number.isFinite(amount) ? MONEY.format(amount) : fact.value
    }
    case 'hours': {
      const hours = Number(fact.value)
      return Number.isFinite(hours) ? `${formatHours(hours)}h` : fact.value
    }
    case 'date':
      return formatCalendarDate(fact.value) ?? fact.value
    default:
      return fact.value
  }
}

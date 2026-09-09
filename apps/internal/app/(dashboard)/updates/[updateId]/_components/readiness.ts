import type { ClientUpdateItem } from '@/lib/updates/types'

type ReadinessInput = {
  subject: string
  items: ClientUpdateItem[]
  to: string[]
  busy: boolean
}

/**
 * Why the send buttons are disabled, phrased for a tooltip; null when the
 * button is enabled. Test and send share the content rules; send also needs
 * a recipient.
 */
export function sendReadiness({ subject, items, to, busy }: ReadinessInput) {
  const contentBlocker =
    subject.trim().length === 0
      ? 'Add a subject to send.'
      : items.length === 0
        ? 'Add at least one item to send.'
        : items.some(item => item.label.trim().length === 0)
          ? 'Every item needs a label to send.'
          : null
  const testBlocker = busy ? null : contentBlocker
  const sendBlocker =
    testBlocker ?? (to.length === 0 ? 'Choose at least one recipient.' : null)

  return {
    testBlocker,
    sendBlocker,
    canTest: !busy && !contentBlocker,
    canSend: !busy && !contentBlocker && to.length > 0,
  }
}

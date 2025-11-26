export const CLIENT_BILLING_TYPE_VALUES = ['prepaid', 'net_30'] as const

export type ClientBillingTypeValue = (typeof CLIENT_BILLING_TYPE_VALUES)[number]

export const CLIENT_BILLING_TYPE_SELECT_OPTIONS: Array<{
  value: ClientBillingTypeValue
  label: string
  description?: string
}> = [
  {
    value: 'prepaid',
    label: 'Prepaid',
    description: 'Hours draw down from purchased blocks.',
  },
  {
    value: 'net_30',
    label: 'Net 30',
    description: 'Clients are invoiced at the end of each month.',
  },
]

export function getBillingTypeLabel(
  billingType: ClientBillingTypeValue
): string {
  const option = CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
    opt => opt.value === billingType
  )
  return option?.label ?? billingType
}

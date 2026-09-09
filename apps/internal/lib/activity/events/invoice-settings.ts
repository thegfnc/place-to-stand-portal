import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

type DiffDetails = {
  before: Record<string, unknown>
  after: Record<string, unknown>
}

export const productCatalogItemCreatedEvent = (args: {
  name: string
  unitPrice: string
  unitLabel: string
  isActive: boolean
}): ActivityEvent => ({
  verb: ActivityVerbs.PRODUCT_CATALOG_ITEM_CREATED,
  summary: `Created product ${args.name}`,
  metadata: toMetadata({
    name: args.name,
    unitPrice: args.unitPrice,
    unitLabel: args.unitLabel,
    isActive: args.isActive,
  }),
})

export const productCatalogItemUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  details?: DiffDetails
}): ActivityEvent => ({
  verb: ActivityVerbs.PRODUCT_CATALOG_ITEM_UPDATED,
  summary: `Updated product ${args.name}${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const taxRateCreatedEvent = (args: {
  label: string
  state: string
  rate: string
  isActive: boolean
}): ActivityEvent => ({
  verb: ActivityVerbs.TAX_RATE_CREATED,
  summary: `Created tax rate ${args.label}`,
  metadata: toMetadata({
    label: args.label,
    state: args.state,
    rate: args.rate,
    isActive: args.isActive,
  }),
})

export const taxRateUpdatedEvent = (args: {
  label: string
  changedFields: string[]
  details?: DiffDetails
}): ActivityEvent => ({
  verb: ActivityVerbs.TAX_RATE_UPDATED,
  summary: `Updated tax rate ${args.label}${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

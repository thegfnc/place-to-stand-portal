'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser, type AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import {
  productCatalogItemCreatedEvent,
  productCatalogItemUpdatedEvent,
  taxRateCreatedEvent,
  taxRateUpdatedEvent,
} from '@/lib/activity/events'
import type { ActivityEvent } from '@/lib/activity/types'
import {
  createProductCatalogItem,
  getProductCatalogItemById,
  updateProductCatalogItem,
  type ProductCatalogItemRow,
} from '@/lib/queries/product-catalog'
import {
  createTaxRate,
  getTaxRateById,
  updateTaxRate,
  toggleTaxRateActive,
  type TaxRateRow,
} from '@/lib/queries/tax-rates'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const productCatalogItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  unitPrice: z.string().min(1, 'Unit price is required'),
  unitLabel: z.string().trim().min(1, 'Unit label is required').max(50),
  createsHourBlockDefault: z.boolean(),
  isActive: z.boolean(),
  minQuantity: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0),
})
const taxRateSchema = z.object({
  id: z.string().uuid().optional(),
  state: z.string().trim().min(1, 'State is required').max(50),
  rate: z.string().min(1, 'Rate is required'),
  label: z.string().trim().min(1, 'Label is required').max(100),
  isActive: z.boolean(),
})

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

type Diff = {
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}

/**
 * Compares two rows field by field. `fields` maps the row key to the
 * human-readable label used in `changedFields`; `details` keeps the raw
 * values under the camelCase form of the row key so the feed can format
 * them like every other domain's diff.
 */
const toCamel = (key: string) =>
  key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())

function diffRows<T extends object>(
  before: T,
  after: T,
  fields: Record<string, string>
): Diff {
  const diff: Diff = { changedFields: [], details: { before: {}, after: {} } }

  for (const [key, label] of Object.entries(fields)) {
    const previous = (before as Record<string, unknown>)[key] ?? null
    const next = (after as Record<string, unknown>)[key] ?? null

    if (previous !== next) {
      diff.changedFields.push(label)
      diff.details.before[toCamel(key)] = previous
      diff.details.after[toCamel(key)] = next
    }
  }

  return diff
}

async function logSettingsEvent(
  user: AppUser,
  targetId: string,
  event: ActivityEvent
) {
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'SETTINGS',
    targetId,
    metadata: event.metadata,
  })
}

const PRODUCT_FIELDS: Partial<Record<keyof ProductCatalogItemRow, string>> = {
  name: 'name',
  description: 'description',
  unit_price: 'unit price',
  unit_label: 'unit label',
  creates_hour_block_default: 'hour block default',
  is_active: 'active',
  min_quantity: 'minimum quantity',
  sort_order: 'sort order',
}

const TAX_RATE_FIELDS: Partial<Record<keyof TaxRateRow, string>> = {
  label: 'label',
  state: 'state',
  rate: 'rate',
  is_active: 'active',
}

// ---------------------------------------------------------------------------
// Product Catalog Actions
// ---------------------------------------------------------------------------

export type SaveProductResult = { ok: true } | { ok: false; error: string }

export async function saveProductCatalogItem(
  input: z.infer<typeof productCatalogItemSchema>
): Promise<SaveProductResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = productCatalogItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const values = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    unitPrice: parsed.data.unitPrice,
    unitLabel: parsed.data.unitLabel,
    createsHourBlockDefault: parsed.data.createsHourBlockDefault,
    isActive: parsed.data.isActive,
    minQuantity: parsed.data.minQuantity ?? null,
    sortOrder: parsed.data.sortOrder,
  }

  try {
    if (parsed.data.id) {
      const existing = await getProductCatalogItemById(parsed.data.id)
      if (!existing) {
        return { ok: false, error: 'Product not found.' }
      }

      const updated = await updateProductCatalogItem(parsed.data.id, values)

      if (!updated) {
        return { ok: false, error: 'Product not found.' }
      }

      const diff = diffRows(existing, updated, PRODUCT_FIELDS)
      if (diff.changedFields.length > 0) {
        await logSettingsEvent(
          user,
          updated.id,
          productCatalogItemUpdatedEvent({
            name: updated.name,
            changedFields: diff.changedFields,
            details: diff.details,
          })
        )
      }
    } else {
      const created = await createProductCatalogItem(values)

      await logSettingsEvent(
        user,
        created.id,
        productCatalogItemCreatedEvent({
          name: created.name,
          unitPrice: created.unit_price,
          unitLabel: created.unit_label,
          isActive: created.is_active,
        })
      )
    }

    revalidatePath('/invoices/settings')
    return { ok: true }
  } catch (error) {
    console.error('Failed to save product catalog item:', error)
    return { ok: false, error: 'Unable to save product. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Tax Rate Actions
// ---------------------------------------------------------------------------

export type SaveTaxRateResult = { ok: true } | { ok: false; error: string }

export async function saveTaxRate(
  input: z.infer<typeof taxRateSchema>
): Promise<SaveTaxRateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = taxRateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const values = {
    state: parsed.data.state,
    rate: parsed.data.rate,
    label: parsed.data.label,
    isActive: parsed.data.isActive,
  }

  try {
    if (parsed.data.id) {
      const existing = await getTaxRateById(parsed.data.id)
      if (!existing) {
        return { ok: false, error: 'Tax rate not found.' }
      }

      const updated = await updateTaxRate(parsed.data.id, values)

      const diff = diffRows(existing, updated, TAX_RATE_FIELDS)
      if (diff.changedFields.length > 0) {
        await logSettingsEvent(
          user,
          updated.id,
          taxRateUpdatedEvent({
            label: updated.label,
            changedFields: diff.changedFields,
            details: diff.details,
          })
        )
      }
    } else {
      const created = await createTaxRate(values)

      await logSettingsEvent(
        user,
        created.id,
        taxRateCreatedEvent({
          label: created.label,
          state: created.state,
          rate: created.rate,
          isActive: created.is_active,
        })
      )
    }

    revalidatePath('/invoices/settings')
    return { ok: true }
  } catch (error) {
    console.error('Failed to save tax rate:', error)
    return { ok: false, error: 'Unable to save tax rate. Please try again.' }
  }
}

export async function toggleTaxRateActiveAction(
  id: string,
  isActive: boolean
): Promise<SaveTaxRateResult> {
  const user = await requireUser()
  assertAdmin(user)

  try {
    const existing = await getTaxRateById(id)
    if (!existing) {
      return { ok: false, error: 'Tax rate not found.' }
    }

    const updated = await toggleTaxRateActive(id, isActive)

    if (existing.is_active !== updated.is_active) {
      await logSettingsEvent(
        user,
        updated.id,
        taxRateUpdatedEvent({
          label: updated.label,
          changedFields: ['active'],
          details: {
            before: { isActive: existing.is_active },
            after: { isActive: updated.is_active },
          },
        })
      )
    }

    revalidatePath('/invoices/settings')
    return { ok: true }
  } catch (error) {
    console.error('Failed to toggle tax rate:', error)
    return { ok: false, error: 'Unable to toggle tax rate. Please try again.' }
  }
}

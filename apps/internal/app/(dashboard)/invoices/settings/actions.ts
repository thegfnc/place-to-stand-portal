'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  createProductCatalogItem,
  updateProductCatalogItem
} from '@/lib/queries/product-catalog'
import {
  createTaxRate,
  updateTaxRate,
  toggleTaxRateActive,
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

  try {
    if (parsed.data.id) {
      const updated = await updateProductCatalogItem(parsed.data.id, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        unitLabel: parsed.data.unitLabel,
        createsHourBlockDefault: parsed.data.createsHourBlockDefault,
        isActive: parsed.data.isActive,
        minQuantity: parsed.data.minQuantity ?? null,
        sortOrder: parsed.data.sortOrder,
      })

      if (!updated) {
        return { ok: false, error: 'Product not found.' }
      }
    } else {
      await createProductCatalogItem({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        unitLabel: parsed.data.unitLabel,
        createsHourBlockDefault: parsed.data.createsHourBlockDefault,
        isActive: parsed.data.isActive,
        minQuantity: parsed.data.minQuantity ?? null,
        sortOrder: parsed.data.sortOrder,
      })
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

  try {
    if (parsed.data.id) {
      await updateTaxRate(parsed.data.id, {
        state: parsed.data.state,
        rate: parsed.data.rate,
        label: parsed.data.label,
        isActive: parsed.data.isActive,
      })
    } else {
      await createTaxRate({
        state: parsed.data.state,
        rate: parsed.data.rate,
        label: parsed.data.label,
        isActive: parsed.data.isActive,
      })
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
    await toggleTaxRateActive(id, isActive)
    revalidatePath('/invoices/settings')
    return { ok: true }
  } catch (error) {
    console.error('Failed to toggle tax rate:', error)
    return { ok: false, error: 'Unable to toggle tax rate. Please try again.' }
  }
}

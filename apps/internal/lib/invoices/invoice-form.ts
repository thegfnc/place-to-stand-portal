import { z } from 'zod'

import type { ProductCatalogItemRow } from '@/lib/queries/product-catalog'

// ---------------------------------------------------------------------------
// Row types (snake_case, matching query layer)
// ---------------------------------------------------------------------------

type InvoiceRow = {
  id: string
  invoice_number: string | null
  status: string
  client_id: string
  created_by: string | null
  issued_date: string | null
  due_date: string | null
  subtotal: string
  tax_rate: string | null
  tax_amount: string
  total: string
  notes: string | null
  share_token: string | null
  share_enabled: boolean
  billing_type: string | null
  viewed_at: string | null
  viewed_count: number
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type InvoiceLineItemRow = {
  id: string
  invoice_id: string
  product_catalog_item_id: string | null
  description: string
  quantity: string
  unit_price: string
  amount: string
  sort_order: number
  creates_hour_block: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ClientRow = {
  id: string
  name: string
  billing_type: string
  state: string | null
  deleted_at: string | null
}

export type InvoiceWithClient = InvoiceRow & {
  client: { id: string; name: string; slug: string | null; deleted_at: string | null } | null
}

export type InvoiceWithLineItems = InvoiceWithClient & {
  line_items: InvoiceLineItemRow[]
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const invoiceLineItemFormSchema = z.object({
  id: z.string().uuid().optional(),
  productCatalogItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be zero or positive'),
  createsHourBlock: z.boolean().default(false),
})

export const invoiceFormSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  notes: z.string().optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  lineItems: z
    .array(invoiceLineItemFormSchema)
    .min(1, 'At least one line item is required'),
})

export type InvoiceLineItemFormValues = z.infer<
  typeof invoiceLineItemFormSchema
>
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

// ---------------------------------------------------------------------------
// Form field list (for resetField / dirtyFields)
// ---------------------------------------------------------------------------

export const INVOICE_FORM_FIELDS: Array<keyof InvoiceFormValues> = [
  'clientId',
  'notes',
  'taxRate',
  'lineItems',
]

// ---------------------------------------------------------------------------
// Empty line item factory
// ---------------------------------------------------------------------------

export const createEmptyLineItem = (): InvoiceLineItemFormValues => ({
  id: undefined,
  productCatalogItemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0,
  createsHourBlock: false,
})

export const createLineItemFromCatalog = (
  product: ProductCatalogItemRow,
): InvoiceLineItemFormValues => ({
  id: undefined,
  productCatalogItemId: product.id,
  description: product.name,
  quantity: product.min_quantity ?? 1,
  unitPrice: Number(product.unit_price),
  createsHourBlock: product.creates_hour_block_default,
})

// ---------------------------------------------------------------------------
// Build form defaults from DB record
// ---------------------------------------------------------------------------

export const buildInvoiceFormDefaults = (
  invoice: InvoiceWithLineItems | null
): InvoiceFormValues => {
  if (!invoice) {
    return {
      clientId: '',
      notes: null,
      taxRate: 0,
      lineItems: [createEmptyLineItem()],
    }
  }

  const taxRateDecimal = invoice.tax_rate ? Number(invoice.tax_rate) : 0
  const taxRatePercent = taxRateDecimal * 100

  return {
    clientId: invoice.client_id,
    notes: invoice.notes ?? null,
    taxRate: taxRatePercent,
    lineItems:
      invoice.line_items.length > 0
        ? invoice.line_items.map(li => ({
            id: li.id,
            productCatalogItemId: li.product_catalog_item_id ?? null,
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unit_price),
            createsHourBlock: li.creates_hour_block,
          }))
        : [createEmptyLineItem()],
  }
}

// ---------------------------------------------------------------------------
// Save payload
// ---------------------------------------------------------------------------

type InvoiceLineItemSavePayload = {
  id?: string
  productCatalogItemId: string | null
  description: string
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
  createsHourBlock: boolean
}

export type InvoiceSavePayload = {
  id?: string
  clientId: string
  notes: string | null
  taxRate: number
  subtotal: number
  taxAmount: number
  total: number
  lineItems: InvoiceLineItemSavePayload[]
}

export const createInvoiceSavePayload = (
  values: InvoiceFormValues,
  invoice: InvoiceWithLineItems | null
): InvoiceSavePayload => {
  const lineItems: InvoiceLineItemSavePayload[] = values.lineItems.map(
    (li, index) => {
      const amount = computeLineItemAmount(li.quantity, li.unitPrice)
      return {
        id: li.id,
        productCatalogItemId: li.productCatalogItemId ?? null,
        description: li.description.trim(),
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount,
        sortOrder: index,
        createsHourBlock: li.createsHourBlock,
      }
    }
  )

  const totals = computeInvoiceTotals(values.lineItems, values.taxRate)

  return {
    id: invoice?.id,
    clientId: values.clientId,
    notes:
      values.notes && values.notes.trim().length > 0
        ? values.notes.trim()
        : null,
    taxRate: values.taxRate / 100, // percentage → decimal for DB
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    lineItems,
  }
}

// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------

export const computeLineItemAmount = (
  quantity: number,
  unitPrice: number
): number => {
  return Math.round(quantity * unitPrice * 100) / 100
}

export const computeInvoiceTotals = (
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRatePercent: number
): { subtotal: number; taxAmount: number; total: number } => {
  const subtotal = lineItems.reduce(
    (sum, li) => sum + computeLineItemAmount(li.quantity, li.unitPrice),
    0
  )

  const taxDecimal = taxRatePercent / 100
  const taxAmount = Math.round(subtotal * taxDecimal * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100

  return { subtotal, taxAmount, total }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { ProductCatalogItemRow }

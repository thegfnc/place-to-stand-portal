import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { taxRates } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaxRateRow = {
  id: string
  state: string
  rate: string
  label: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TaxRateInput = {
  state: string
  rate: string
  label: string
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

const taxRateSelection = {
  id: taxRates.id,
  state: taxRates.state,
  rate: taxRates.rate,
  label: taxRates.label,
  isActive: taxRates.isActive,
  createdAt: taxRates.createdAt,
  updatedAt: taxRates.updatedAt,
} as const

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listTaxRates(): Promise<TaxRateRow[]> {
  const rows = await db
    .select(taxRateSelection)
    .from(taxRates)
    .orderBy(asc(taxRates.state))

  return rows.map(mapTaxRateRow)
}

export async function createTaxRate(input: TaxRateInput): Promise<TaxRateRow> {
  const rows = await db
    .insert(taxRates)
    .values({
      state: input.state,
      rate: input.rate,
      label: input.label,
      isActive: input.isActive,
    })
    .returning(taxRateSelection)

  return mapTaxRateRow(rows[0]!)
}

export async function updateTaxRate(
  id: string,
  input: TaxRateInput
): Promise<TaxRateRow> {
  const rows = await db
    .update(taxRates)
    .set({
      state: input.state,
      rate: input.rate,
      label: input.label,
      isActive: input.isActive,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(eq(taxRates.id, id))
    .returning(taxRateSelection)

  return mapTaxRateRow(rows[0]!)
}

export async function toggleTaxRateActive(
  id: string,
  isActive: boolean
): Promise<TaxRateRow> {
  const rows = await db
    .update(taxRates)
    .set({
      isActive,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(eq(taxRates.id, id))
    .returning(taxRateSelection)

  return mapTaxRateRow(rows[0]!)
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapTaxRateRow(row: {
  id: string
  state: string
  rate: string
  label: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}): TaxRateRow {
  return {
    id: row.id,
    state: row.state,
    rate: row.rate,
    label: row.label,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

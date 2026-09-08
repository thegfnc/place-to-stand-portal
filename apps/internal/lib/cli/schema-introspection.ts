import { is } from 'drizzle-orm'
import { getTableConfig, isPgEnum, PgTable } from 'drizzle-orm/pg-core'

import * as schema from '@pts/db/schema'

/**
 * Schema orientation for agents, derived from the Drizzle definitions rather
 * than queried from Postgres. That keeps it honest (it is the same source the
 * app writes through), free (no round trip), and — importantly — means the CLI
 * exposes no SQL execution surface at all.
 */
type CliColumn = {
  name: string
  sqlType: string
  nullable: boolean
  hasDefault: boolean
  primaryKey: boolean
  /** Allowed values when the column is a Postgres enum. */
  enumValues: string[] | null
}

type CliForeignKey = {
  columns: string[]
  referencesTable: string
  referencesColumns: string[]
}

export type CliTableSummary = {
  name: string
  columnCount: number
}

export type CliTableDetail = CliTableSummary & {
  columns: CliColumn[]
  foreignKeys: CliForeignKey[]
}

export type CliEnum = {
  name: string
  values: string[]
}

// Widened to `unknown[]` before filtering: the module's exports type as a
// union of ~50 concrete table/enum/view types, and a `PgTable` predicate is not
// assignable to that union.
const schemaExports: unknown[] = Object.values(schema)

function tables(): PgTable[] {
  return schemaExports.filter((value): value is PgTable => is(value, PgTable))
}

function describe(table: PgTable): CliTableDetail {
  const config = getTableConfig(table)

  return {
    name: config.name,
    columnCount: config.columns.length,
    columns: config.columns.map(column => ({
      name: column.name,
      sqlType: column.getSQLType(),
      nullable: !column.notNull,
      hasDefault: column.hasDefault,
      primaryKey: column.primary,
      enumValues: column.enumValues ? [...column.enumValues] : null,
    })),
    foreignKeys: config.foreignKeys.map(foreignKey => {
      const reference = foreignKey.reference()

      return {
        columns: reference.columns.map(column => column.name),
        referencesTable: getTableConfig(reference.foreignTable).name,
        referencesColumns: reference.foreignColumns.map(column => column.name),
      }
    }),
  }
}

export function listTables(): CliTableSummary[] {
  return tables()
    .map(table => {
      const config = getTableConfig(table)

      return { name: config.name, columnCount: config.columns.length }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function describeTable(tableName: string): CliTableDetail | null {
  const match = tables().find(
    table => getTableConfig(table).name === tableName
  )

  return match ? describe(match) : null
}

export function listEnums(): CliEnum[] {
  return schemaExports
    .filter(isPgEnum)
    .map(enumeration => ({
      name: enumeration.enumName,
      values: [...enumeration.enumValues],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

import type { ClientWithMetrics } from '@/lib/data/clients'
import type { ParsedSort } from '@/lib/pagination/sort'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'
import type { ClientLandingSortField } from '@/lib/settings/clients/filters'

/**
 * Value a row sorts by in the active column. `null` means the cell renders
 * as `—` (no billing hours, no origination, no closer).
 */
type SortKey = string | number | null

/**
 * Read the sort key straight off the same field the cell renders, so the
 * order always matches the visible number/label.
 */
function sortKeyFor(
  client: ClientWithMetrics,
  field: ClientLandingSortField
): SortKey {
  switch (field) {
    case 'created':
      return client.createdAt
    case 'billing':
      // Sort by the badge label, not the enum value, so ascending reads the
      // way the column looks ('Net 30' before 'Prepaid').
      return getBillingTypeLabel(client.billingType)
    case 'projects':
      return client.activeProjects.length
    case 'contacts':
      return client.contacts.length
    case 'hours':
      // Only prepaid clients carry an hours balance; net_30 rows render `—`
      // and sort as empty rather than as a misleading 0.
      return client.billingType === 'prepaid' ? client.hoursRemaining : null
    case 'origination':
      return client.originationUserName ?? client.originationContactName ?? null
    case 'closer':
      return client.closerUserName ?? null
    case 'name':
    default:
      return client.name
  }
}

function compareKeys(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  return String(a).localeCompare(String(b))
}

/**
 * The landing table is unpaginated (fetchClientsWithMetrics), so sorting is
 * a plain in-memory sort of the fetched array (PRD 004 §03 — no keyset
 * cursor concerns on this view). That's also what lets columns backed by
 * computed metrics sort at all: `hours` and `projects` have no SQL
 * descriptor, so they're landing-only fields.
 */
export function sortLandingClients(
  clients: ClientWithMetrics[],
  sort: ParsedSort<ClientLandingSortField>
): ClientWithMetrics[] {
  const factor = sort.direction === 'asc' ? 1 : -1

  return [...clients].sort((a, b) => {
    const aKey = sortKeyFor(a, sort.field)
    const bKey = sortKeyFor(b, sort.field)

    // Empty cells sink to the bottom in BOTH directions, matching the NULLS
    // LAST policy the keyset descriptors use — flipping the arrow shouldn't
    // fill the top of the table with dashes.
    if (aKey === null || bKey === null) {
      if (aKey === bKey) return a.name.localeCompare(b.name)
      return aKey === null ? 1 : -1
    }

    const result = compareKeys(aKey, bKey) * factor
    // Name is the tie-breaker so equal billing types / project counts keep a
    // stable, readable order instead of whatever Postgres returned.
    return result !== 0 ? result : a.name.localeCompare(b.name)
  })
}

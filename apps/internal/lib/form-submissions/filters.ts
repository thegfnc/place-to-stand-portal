import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

// PRD 004 §03: per-view sort allowlist (D6/R5). Submissions are OFFSET
// paginated, so each field here needs only a matching ORDER BY expression in
// the query — no cursor descriptors. `received` maps to last_activity_at,
// the column the Received column renders and today's hardcoded order.
const SUBMISSION_SORT_FIELDS = ['received'] as const
export type SubmissionSortField = (typeof SUBMISSION_SORT_FIELDS)[number]

export const DEFAULT_SUBMISSIONS_SORT = {
  field: 'received',
  direction: 'desc',
} as const satisfies ParsedSort<SubmissionSortField>

export function isSubmissionSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (SUBMISSION_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

/**
 * Parse `?sort=` for the submissions pages. Invalid or absent values fall
 * back to the view default (received desc).
 */
export function parseSubmissionsSort(
  raw: string | undefined
): ParsedSort<SubmissionSortField> {
  return parseSortParam(raw, SUBMISSION_SORT_FIELDS, DEFAULT_SUBMISSIONS_SORT)
}

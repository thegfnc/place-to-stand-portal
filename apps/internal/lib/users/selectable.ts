/**
 * Whether a user may be offered as a *new* selection (assignee, owner,
 * closer, lead assignee, board person filter).
 *
 * Disabled users (`disabled_at` set) are departed staff: they must keep
 * resolving wherever they are already referenced — task cards, closed-month
 * reports, commission attribution — but must not be offered again. Archived
 * users (`deleted_at`) are excluded for the same reason. Accepts both the
 * snake_case `DbUser` shape and the camelCase option shapes.
 */
export type SelectableUserFlags = {
  deleted_at?: string | null
  disabled_at?: string | null
  deletedAt?: string | null
  disabledAt?: string | null
}

export function isSelectableUser(user: SelectableUserFlags): boolean {
  return !(
    user.deleted_at ||
    user.disabled_at ||
    user.deletedAt ||
    user.disabledAt
  )
}

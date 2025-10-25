export function deriveInitials(
  fullName?: string | null,
  email?: string | null
) {
  const safeName = fullName?.trim()

  if (safeName) {
    const segments = safeName.split(/\s+/).filter(Boolean).slice(0, 2)

    if (segments.length > 0) {
      return (
        segments.map(segment => segment.charAt(0).toUpperCase()).join('') ||
        '??'
      )
    }
  }

  if (email) {
    return email.slice(0, 2).toUpperCase()
  }

  return '??'
}

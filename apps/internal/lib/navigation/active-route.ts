/**
 * Single source of truth for active-route matching (PRD 004 §02).
 * Previously duplicated verbatim in components/layout/sidebar.tsx and
 * components/layout/app-shell.tsx — any change here affects both the
 * sidebar highlight and header derivations.
 */

type Matchable = {
  href: string
  matchHrefs?: string[]
}

function matchesPath(pathname: string, target: string): boolean {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

export function isNavItemActive(pathname: string, item: Matchable): boolean {
  const candidates = [item.href, ...(item.matchHrefs ?? [])]
  return candidates.some(candidate => matchesPath(pathname, candidate))
}

/**
 * Canonical sheet deep-link builders. Everything that *generates* a link to
 * an entity sheet (tables, dashboards, cross-module anchors) goes through
 * these so shared URLs always point at the entity's canonical host page.
 * Board task links are built by `buildBoardPath` (lib/projects/board) since
 * they need client/project slugs; everything else lives here.
 */

import { NEW_SHEET_VALUE } from './entities'

export const clientSheetHref = (id: string) => `/clients?client=${id}`

export const contactSheetHref = (id: string) => `/contacts?contact=${id}`

export const invoiceHref = (id: string) => `/invoices?invoice=${id}`

export const hourBlockHref = (id: string) => `/hour-blocks?hour-block=${id}`

/** Client detail page; slugs are canonical but the page also resolves ids. */
export const clientDetailHref = (client: { slug: string | null; id: string }) =>
  `/clients/${client.slug ?? client.id}`

/** The client-update composer — a full page, not a sheet. */
export const updateComposerHref = (id: string) => `/updates/${id}`

export const leadHref = (
  id: string,
  options?: { archived?: boolean; convert?: boolean }
) => {
  const base = options?.archived ? '/leads/archive' : '/leads'
  const convert = options?.convert ? '&leadMode=convert' : ''
  return `${base}?lead=${id}${convert}`
}

export const newLeadHref = () => `/leads?lead=${NEW_SHEET_VALUE}`
/**
 * Rebuilds a page's query string for a server-side `redirect()`. Redirects
 * must carry the whole query across — the sheet stack and any filters live
 * there — not just the one param the route happens to care about.
 */
export const buildQuerySuffix = (
  searchParams: Record<string, string | string[] | undefined>
) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach(entry => params.append(key, entry))
    } else if (value !== undefined) {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export type MyTasksView = 'board' | 'calendar'

export const myTaskHref = (taskId: string, view: MyTasksView = 'board') =>
  `/my/tasks/${view}?task=${taskId}`

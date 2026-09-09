import 'server-only'

import { cookies } from 'next/headers'

import {
  PAGE_SIZE_COOKIE,
  parsePageSize,
  type PageSizeOption,
} from './page-size'

/**
 * The viewer's persisted rows-per-page, read from the request cookies so a
 * list page renders the right page length on first paint. Reading cookies
 * makes the page dynamic — every list page already is (searchParams).
 */
export async function readPageSize(): Promise<PageSizeOption> {
  const store = await cookies()
  return parsePageSize(store.get(PAGE_SIZE_COOKIE)?.value)
}

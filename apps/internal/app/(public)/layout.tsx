import type { ReactNode } from 'react'

import { BRAND, BRAND_DOT_GRID } from '@pts/ui/brand'

import { PublicFooter } from './_components/public-footer'

/**
 * Chrome for pages clients open from a link: the marketing site's dark
 * blueprint ground, whatever the viewer's theme, like the auth screens. Pages
 * render their own header so it can carry page context (an invoice number).
 *
 * The root layout locks the body to the viewport, so this wrapper scrolls; the
 * dot grid sits on the inner column so it scrolls with the content.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className='h-screen overflow-auto [color-scheme:dark]'>
      <div
        className='flex min-h-full flex-col text-[#e8e6e3]'
        style={{ backgroundColor: BRAND.bg, ...BRAND_DOT_GRID }}
      >
        {children}
        <PublicFooter />
      </div>
    </div>
  )
}

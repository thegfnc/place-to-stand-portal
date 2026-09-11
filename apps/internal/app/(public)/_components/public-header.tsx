import type { ReactNode } from 'react'

import { BrandLogo } from '@pts/ui/brand'

/** Logo left, page context (a mono tag) right — the marketing header, minus nav. */
export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className='border-b border-[#2a2b30] bg-[#0e0f11]/90'>
      <div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6 sm:py-4 lg:px-12'>
        <BrandLogo size='md' tone='brand' className='sm:hidden' />
        <BrandLogo size='lg' tone='brand' className='hidden sm:inline-flex' />
        {children}
      </div>
    </header>
  )
}

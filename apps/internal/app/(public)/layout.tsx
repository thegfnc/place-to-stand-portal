import type { ReactNode } from 'react'

import { BrandLogo } from '@pts/ui/brand'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-auto bg-background" style={{ height: '100vh' }}>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <BrandLogo size="md" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}

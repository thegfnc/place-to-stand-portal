import type { ReactNode } from 'react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRole('ADMIN')

  return (
    <div className='space-y-6'>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Settings</h1>
          <p className='text-muted-foreground text-sm'>
            Manage people, clients, projects, and purchased hour blocks across
            the agency.
          </p>
        </div>
      </AppShellHeader>
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        {children}
      </section>
    </div>
  )
}

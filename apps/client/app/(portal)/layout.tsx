export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BrandLogo } from '@pts/ui/brand'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { UserMenu } from '@/components/layout/user-menu'
import { ViewAsBanner } from '@/components/layout/view-as-banner'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireClientUser()

  // Redirect CLIENT users to onboarding if they haven't completed it.
  // Admins skip onboarding (they're just previewing the portal).
  if (user.role === 'CLIENT' && !user.onboarding_completed_at) {
    redirect('/onboarding')
  }

  // cache()-wrapped, so the pages below reuse this same resolution.
  const scope = await resolvePortalScope(user)

  return (
    <div className="min-h-screen bg-background">
      {isAdmin(user) && (
        <ViewAsBanner
          availableContacts={scope.availableContacts}
          viewingAsContactId={scope.viewingAsContactId}
        />
      )}
      <header className="border-b border-foreground/10 bg-chrome">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          {/* Doubles as the way back to the portal home now that the nav
              links are gone. */}
          <Link
            href="/"
            aria-label="Place to Stand Client Portal — home"
            className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size="sm" className="shrink-0" />

            {/* Hidden on the narrowest screens: the wordmark alone is enough
                there, and the account menu needs the room. */}
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 bg-border sm:block"
            />
            <span className="hidden truncate text-sm text-muted-foreground sm:block">
              Client Portal
            </span>
          </Link>
          <UserMenu email={user.email} scopedClients={scope.scopedClients} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}

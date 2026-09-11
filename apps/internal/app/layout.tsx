import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'

import { AppProviders } from '@/components/providers/app-providers'
import { SupabaseListener } from '@/components/providers/supabase-listener'
import { cn } from '@/lib/utils'
import { getSession } from '@/lib/auth/session'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/** The marketing site's logo face — the `BrandLogo` wordmark reads it. */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || 'http://localhost:3000'),
  title: 'Place to Stand Portal',
  description: 'Client and project management for Place to Stand Agency.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getSession()
  const initialSession = session
    ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }
    : null

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* Synchronous theme init — must run before first paint to avoid a
            light-mode flash. Safe to render raw: hydration only re-renders
            this tree if something else mismatches (see use-mobile). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={cn(
          'bg-background h-screen overflow-hidden font-sans antialiased',
          geistSans.variable,
          geistMono.variable,
          spaceGrotesk.variable
        )}
      >
        <AppProviders>
          <SupabaseListener initialSession={initialSession} />
          {children}
        </AppProviders>
        <Analytics />
      </body>
    </html>
  )
}

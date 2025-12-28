'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

import type { AppUser } from '@/lib/auth/session'

import { Sidebar } from './sidebar'
import { UserMenu } from './user-menu'
import { NAV_GROUPS } from './navigation-config'

interface Props {
  user: AppUser
  children: ReactNode
}

type HeaderContextValue = {
  setHeader: (content: ReactNode) => void
  clearHeader: () => void
}

const HeaderContext = createContext<HeaderContextValue | null>(null)

export function useAppShellHeader() {
  const context = useContext(HeaderContext)

  if (!context) {
    throw new Error('useAppShellHeader must be used within AppShell')
  }

  return context
}

export function AppShellHeader({ children }: { children: ReactNode }) {
  const { setHeader, clearHeader } = useAppShellHeader()

  useEffect(() => {
    setHeader(children)
    return () => {
      clearHeader()
    }
  }, [children, clearHeader, setHeader])

  return null
}

export function AppShell({ user, children }: Props) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null)
  const pathname = usePathname()

  const currentNav = useMemo(() => {
    const matchesPath = (target: string) =>
      pathname === target || pathname.startsWith(target + '/')

    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const matchTargets = [item.href, ...(item.matchHrefs ?? [])]

        if (matchTargets.some(matchesPath)) {
          return item
        }
      }
    }
    return null
  }, [pathname])

  const Icon = currentNav?.icon

  const setHeader = useCallback((content: ReactNode) => {
    setHeaderContent(content)
  }, [])

  const clearHeader = useCallback(() => {
    setHeaderContent(null)
  }, [])

  const headerContextValue = useMemo(
    () => ({
      setHeader,
      clearHeader,
    }),
    [clearHeader, setHeader]
  )

  return (
    <div className='bg-muted flex h-screen overflow-hidden'>
      <Sidebar user={user} />
      <HeaderContext.Provider value={headerContextValue}>
        <div className='flex min-h-0 flex-1 flex-col'>
          <header className='bg-background flex flex-wrap items-center gap-4 border-b px-4 py-4 sm:px-6'>
            {Icon && (
              <div className='bg-muted flex items-center justify-center rounded-md border p-2'>
                <Icon className='text-muted-foreground h-5 w-5' />
              </div>
            )}
            <div className='min-w-0 flex-1'>{headerContent}</div>
            <div className='md:hidden'>
              <UserMenu user={user} />
            </div>
          </header>
          <main className='flex-1 overflow-y-auto p-4 sm:p-6'>{children}</main>
        </div>
      </HeaderContext.Provider>
    </div>
  )
}

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

import type { AppUser } from '@/lib/auth/session'

import { Sidebar } from './sidebar'
import { UserMenu } from './user-menu'

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
    <div className='bg-muted flex min-h-screen'>
      <Sidebar role={user.role} />
      <HeaderContext.Provider value={headerContextValue}>
        <div className='flex min-h-screen flex-1 flex-col'>
          <header className='bg-background flex flex-wrap items-center gap-4 border-b px-6 py-4'>
            <div className='min-w-0 flex-1'>{headerContent}</div>
            <UserMenu user={user} />
          </header>
          <main className='flex-1 overflow-y-auto px-6 py-8'>{children}</main>
        </div>
      </HeaderContext.Provider>
    </div>
  )
}

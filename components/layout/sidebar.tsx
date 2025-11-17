'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Clock3,
  FolderKanban,
  KanbanSquare,
  Building2,
  Users2,
  Home as HomeIcon,
  ListTodo,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AppUser, UserRole } from '@/lib/auth/session'

import { UserMenu } from './user-menu'
import Image from 'next/image'

import PTSLogoBlackTransparent from '../../public/pts-logo-black-transparent.png'
import PTSLogoWhiteTransparent from '../../public/pts-logo-white-transparent.png'
import { Separator } from '../ui/separator'
import { useTheme } from '@/components/providers/theme-provider'

type NavGroup = {
  title?: string | null
  roles: UserRole[]
  items: Array<{
    href: string
    label: string
    icon: LucideIcon
  }>
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Portal',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/home',
        label: 'Home',
        icon: HomeIcon,
      },
      {
        href: '/my-tasks',
        label: 'My Tasks',
        icon: ListTodo,
      },
    ],
  },
  {
    title: 'Work',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/projects',
        label: 'Projects',
        icon: KanbanSquare,
      },
    ],
  },
  {
    title: 'Settings',
    roles: ['ADMIN'],
    items: [
      {
        href: '/settings/users',
        label: 'Users',
        icon: Users2,
      },
      {
        href: '/settings/clients',
        label: 'Clients',
        icon: Building2,
      },
      {
        href: '/settings/projects',
        label: 'Projects',
        icon: FolderKanban,
      },
      {
        href: '/settings/hour-blocks',
        label: 'Hour Blocks',
        icon: Clock3,
      },
    ],
  },
]

type Props = {
  user: AppUser
}

export function Sidebar({ user }: Props) {
  const pathname = usePathname()
  const role = user.role
  const { theme, mounted: themeMounted } = useTheme()

  // Compute logo source - always start with black to match SSR, then update after mount
  const logoSrc = useMemo(() => {
    // During SSR or initial render, always return black to avoid hydration mismatch
    // The theme provider will update this after mount
    if (!themeMounted) {
      return PTSLogoBlackTransparent
    }

    // After theme provider is mounted, use theme from context
    return theme === 'dark' ? PTSLogoWhiteTransparent : PTSLogoBlackTransparent
  }, [theme, themeMounted])

  return (
    <aside className='bg-background/90 hidden w-72 shrink-0 border-r md:flex md:flex-col'>
      <div className='flex flex-1 flex-col'>
        <div className='space-y-10 px-6 py-8'>
          <div suppressHydrationWarning>
            <Image
              key={logoSrc.src}
              src={logoSrc}
              alt='Place To Stand Agency logo'
              className='px-4'
            />
            <Separator className='mt-6' />
          </div>
          <nav className='space-y-8'>
            {NAV_GROUPS.filter(group => group.roles.includes(role)).map(
              (group, index) => (
                <div
                  key={group.title ?? `group-${index}`}
                  className='space-y-2'
                >
                  {group.title ? (
                    <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                      {group.title}
                    </p>
                  ) : null}
                  <div className='space-y-1'>
                    {group.items.map(item => {
                      const Icon = item.icon
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + '/')

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'focus-visible:ring-primary focus-visible:ring-offset-background flex items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className='h-4 w-4' />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </nav>
        </div>
        <div className='mt-auto px-6 py-6'>
          <UserMenu user={user} align='start' />
        </div>
      </div>
    </aside>
  )
}

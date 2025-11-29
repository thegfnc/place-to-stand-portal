import type { LucideIcon } from 'lucide-react'
import {
  Clock3,
  FolderKanban,
  Building2,
  Users,
  Home as HomeIcon,
  ListTodo,
  Handshake,
} from 'lucide-react'
import type { UserRole } from '@/lib/auth/session'

export type NavGroup = {
  title?: string | null
  roles: UserRole[]
  items: Array<{
    href: string
    label: string
    icon: LucideIcon
  }>
}

export const NAV_GROUPS: NavGroup[] = [
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
        href: '/my-tasks/board',
        label: 'My Tasks',
        icon: ListTodo,
      },
    ],
  },
  {
    title: 'Sales',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/leads/board',
        label: 'Leads',
        icon: Handshake,
      },
    ],
  },
  {
    title: 'Work',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/clients',
        label: 'Clients',
        icon: Building2,
      },
      {
        href: '/projects',
        label: 'Projects',
        icon: FolderKanban,
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
        icon: Users,
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

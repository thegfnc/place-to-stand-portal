import type { LucideIcon } from 'lucide-react'
import {
  Clock3,
  FolderKanban,
  Building2,
  Users,
  Home as HomeIcon,
  ListTodo,
  Handshake,
  Plug,
  Contact,
  FileText,
  Receipt,
  Inbox,
  Mail,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  matchHrefs?: string[]
}

export type NavGroup = {
  title?: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Portal',
    items: [
      {
        href: '/my/home',
        label: 'Home',
        icon: HomeIcon,
      },
      {
        href: '/my/tasks/board',
        label: 'Tasks',
        icon: ListTodo,
        matchHrefs: ['/my/tasks', '/my/tasks/calendar'],
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        href: '/submissions',
        label: 'Submissions',
        icon: Inbox,
        matchHrefs: ['/submissions'],
      },
      {
        href: '/leads',
        label: 'Leads',
        icon: Handshake,
      },
      {
        href: '/invoices',
        label: 'Invoices',
        icon: Receipt,
        matchHrefs: ['/invoices'],
      },
      {
        href: '/hour-blocks',
        label: 'Hour Blocks',
        icon: Clock3,
      },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        href: '/projects',
        label: 'Projects',
        icon: FolderKanban,
      },
      {
        href: '/clients',
        label: 'Clients',
        icon: Building2,
      },
      {
        href: '/contacts',
        label: 'Contacts',
        icon: Contact,
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      {
        href: '/reports/monthly-close',
        label: 'Monthly Close',
        icon: FileText,
        matchHrefs: ['/reports'],
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        href: '/settings/users',
        label: 'Users',
        icon: Users,
      },
      {
        href: '/settings/integrations',
        label: 'Integrations',
        icon: Plug,
      },
      {
        href: '/settings/templates/emails',
        label: 'Templates',
        icon: Mail,
        matchHrefs: ['/settings/templates'],
      },
    ],
  },
]

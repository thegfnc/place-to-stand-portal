import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const TEMPLATES_TABS = [
  { label: 'Emails', value: 'emails', href: '/settings/templates/emails' },
  { label: 'PDFs', value: 'pdfs', href: '/settings/templates/pdfs' },
] satisfies readonly TabsNavTab[]

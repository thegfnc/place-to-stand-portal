import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { buildEmailTemplateCatalog } from '@/lib/email/catalog'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { EmailsBrowser } from '../_components/emails-browser'
import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Templates | Settings',
}

export default function EmailTemplatesPage() {
  const entries = buildEmailTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='emails'
    >
      <EmailsBrowser entries={entries} />
    </PageShell>
  )
}

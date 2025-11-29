import type { Metadata } from 'next'

import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Projects | Settings',
}

export default function ProjectsSettingsPage() {
  redirect('/projects')
}

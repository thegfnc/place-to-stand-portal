import { requireRole } from '@/lib/auth/session'
import {
  getPendingSuggestions,
  getSuggestionCounts,
  getProjectsForDropdown,
} from '@/lib/data/suggestions'
import { SuggestionsPanel } from './_components/suggestions-panel'

export default async function SuggestionsPage() {
  await requireRole('ADMIN')

  const [suggestions, counts, projects] = await Promise.all([
    getPendingSuggestions({ limit: 50 }),
    getSuggestionCounts(),
    getProjectsForDropdown(),
  ])

  return (
    <SuggestionsPanel
      initialSuggestions={suggestions}
      initialCounts={counts}
      projects={projects}
    />
  )
}

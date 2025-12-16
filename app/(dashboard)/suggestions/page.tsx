import { requireRole } from '@/lib/auth/session'
import { getPendingSuggestions, getSuggestionCounts, getProjectsForDropdown } from '@/lib/data/suggestions'
import { SuggestionsPanel } from './_components/suggestions-panel'

export default async function SuggestionsPage() {
  await requireRole('ADMIN')

  const [suggestions, counts, projects] = await Promise.all([
    getPendingSuggestions({ limit: 50 }),
    getSuggestionCounts(),
    getProjectsForDropdown(),
  ])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Task Suggestions</h1>
        <p className='text-muted-foreground'>
          Review AI-generated task suggestions from client emails.
        </p>
      </div>
      <SuggestionsPanel
        initialSuggestions={suggestions}
        initialCounts={counts}
        projects={projects}
      />
    </div>
  )
}

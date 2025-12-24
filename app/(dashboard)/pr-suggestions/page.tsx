import { requireRole } from '@/lib/auth/session'
import { getPendingPRSuggestions } from '@/lib/data/pr-suggestions'
import { PRSuggestionsPanel } from './_components/pr-suggestions-panel'

export const metadata = {
  title: 'PR Suggestions',
}

export default async function PRSuggestionsPage() {
  await requireRole('ADMIN')

  const suggestions = await getPendingPRSuggestions()

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>PR Suggestions</h1>
        <p className='text-muted-foreground'>
          Review and create GitHub pull requests from AI suggestions.
        </p>
      </div>
      <PRSuggestionsPanel initialSuggestions={suggestions} />
    </div>
  )
}

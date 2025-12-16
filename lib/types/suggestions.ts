import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { taskSuggestions, suggestionFeedback } from '@/lib/db/schema'

export type TaskSuggestion = InferSelectModel<typeof taskSuggestions>
export type NewTaskSuggestion = InferInsertModel<typeof taskSuggestions>

export type SuggestionFeedback = InferSelectModel<typeof suggestionFeedback>
export type NewSuggestionFeedback = InferInsertModel<typeof suggestionFeedback>

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'EXPIRED'
export type SuggestionPriority = 'HIGH' | 'MEDIUM' | 'LOW'

// Feedback types for AI learning
export type FeedbackType =
  | 'title_changed'
  | 'description_changed'
  | 'project_changed'
  | 'due_date_changed'
  | 'priority_changed'
  | 'rejected_not_actionable'
  | 'rejected_duplicate'
  | 'rejected_irrelevant'

// Full suggestion with related data for UI
export interface TaskSuggestionWithEmail extends TaskSuggestion {
  email: {
    id: string
    subject: string | null
    fromEmail: string
    fromName: string | null
    receivedAt: string
  }
  project?: {
    id: string
    name: string
  } | null
}

// Minimal suggestion for list views
export interface TaskSuggestionSummary {
  id: string
  suggestedTitle: string
  confidence: string
  status: SuggestionStatus
  createdAt: string
  email: {
    subject: string | null
    fromEmail: string
  }
}

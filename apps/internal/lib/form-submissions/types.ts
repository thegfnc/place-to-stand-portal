import type { FormSubmission } from '@pts/db/types'

/**
 * Shapes of the two jsonb columns on `form_submissions`, plus the presentation
 * type the Submissions view consumes.
 *
 * The jsonb blobs are written by the marketing intake routes after Zod
 * validation, so they are well-formed on the way in. The `extract*` helpers
 * below still narrow defensively on the way out — rows predate any future
 * shape change, and `jsonb` is untyped at the Drizzle layer.
 */

type AuditAnswerType = 'single' | 'multi' | 'text'

export type AuditResponseItem = {
  questionId: string
  sectionId: string
  prompt: string
  type: AuditAnswerType
  /** Raw option id(s) or free text. `null` when the question was skipped. */
  value: string | string[] | null
  /** Human-readable option labels. Empty when unanswered. */
  labels: string[]
}

export type AuditRecommendation = {
  serviceId: string
  serviceName: string
  score: number
  reasons: string[]
}

export type AuditResult = {
  phaseId: string
  phaseName: string
  summary: string
  generatedBy: 'rules' | 'ai'
  phaseScores: Record<string, number>
  recommendations: AuditRecommendation[]
}

export type FormSubmissionKindValue = FormSubmission['kind']
export type FormSubmissionStatusValue = FormSubmission['status']

/** A `form_submissions` row with its jsonb columns narrowed for rendering. */
export type FormSubmissionRecord = Omit<
  FormSubmission,
  'responses' | 'result'
> & {
  responses: AuditResponseItem[]
  result: AuditResult | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string') : []
}

export function extractAuditResponses(value: unknown): AuditResponseItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map(item => ({
    questionId: typeof item.questionId === 'string' ? item.questionId : '',
    sectionId: typeof item.sectionId === 'string' ? item.sectionId : '',
    prompt: typeof item.prompt === 'string' ? item.prompt : '',
    type:
      item.type === 'single' || item.type === 'multi' || item.type === 'text'
        ? item.type
        : 'text',
    value:
      typeof item.value === 'string'
        ? item.value
        : Array.isArray(item.value)
          ? toStringArray(item.value)
          : null,
    labels: toStringArray(item.labels),
  }))
}

export function extractAuditResult(value: unknown): AuditResult | null {
  if (!isRecord(value)) {
    return null
  }

  const phaseScores: Record<string, number> = {}
  if (isRecord(value.phaseScores)) {
    for (const [key, score] of Object.entries(value.phaseScores)) {
      if (typeof score === 'number') {
        phaseScores[key] = score
      }
    }
  }

  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations.filter(isRecord).map(item => ({
        serviceId: typeof item.serviceId === 'string' ? item.serviceId : '',
        serviceName:
          typeof item.serviceName === 'string' ? item.serviceName : '',
        score: typeof item.score === 'number' ? item.score : 0,
        reasons: toStringArray(item.reasons),
      }))
    : []

  return {
    phaseId: typeof value.phaseId === 'string' ? value.phaseId : '',
    phaseName: typeof value.phaseName === 'string' ? value.phaseName : '',
    summary: typeof value.summary === 'string' ? value.summary : '',
    generatedBy: value.generatedBy === 'ai' ? 'ai' : 'rules',
    phaseScores,
    recommendations,
  }
}

/** Highest-scoring recommendation, used to denormalize `top_service_id`. */
export function resolveTopServiceId(
  recommendations: AuditRecommendation[] | undefined
): string | null {
  if (!recommendations?.length) {
    return null
  }

  return recommendations.reduce((best, current) =>
    current.score > best.score ? current : best
  ).serviceId
}

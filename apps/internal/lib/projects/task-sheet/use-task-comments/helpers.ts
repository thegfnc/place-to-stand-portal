import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'
import { normalizeRichTextContent } from '@/lib/projects/task-sheet/task-sheet-utils'


export const TASK_COMMENTS_QUERY_KEY = 'task-comments'

export const prepareCommentBody = (content: string): string | null => {
  const sanitized = sanitizeEditorHtml(content)
  const normalized = normalizeRichTextContent(sanitized)

  if (!normalized) {
    return null
  }

  return sanitized
}

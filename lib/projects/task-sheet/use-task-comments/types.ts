import type { TaskCommentWithAuthor } from '@/lib/types'
import type { Json } from '@/supabase/types/database'

export type UseTaskCommentsOptions = {
  taskId: string | null
  projectId: string
  currentUserId: string
  canComment: boolean
  taskTitle?: string | null
  clientId?: string | null
}

export type UseTaskCommentsState = {
  taskId: string | null
  comments: TaskCommentWithAuthor[]
  isLoading: boolean
  isError: boolean
  refresh: () => void
  composer: {
    value: string
    onChange: (value: string) => void
    submit: () => void
    disabled: boolean
    isSubmitting: boolean
    canComment: boolean
  }
  editing: {
    commentId: string | null
    draft: string
    setDraft: (value: string) => void
    start: (comment: TaskCommentWithAuthor) => void
    cancel: () => void
    confirm: () => void
  }
  deletion: {
    targetId: string | null
    request: (id: string) => void
    cancel: () => void
    confirm: () => void
    isPending: boolean
  }
  isMutating: boolean
  pagination: {
    hasNextPage: boolean
    isFetchingNextPage: boolean
    loadMore: () => void
  }
}

export type CommentActivityMetadata = {
  taskId: string
  commentId: string
  bodyLength?: number
}

export type ActivityPayload = {
  actorId: string
  targetProjectId: string
  targetClientId: string | null
  metadata: Json
}

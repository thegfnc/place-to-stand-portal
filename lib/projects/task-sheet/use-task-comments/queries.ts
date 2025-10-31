import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { TaskCommentWithAuthor } from '@/lib/types'
import type { Database } from '@/supabase/types/database'

export type SupabaseBrowserClient = SupabaseClient<Database>

export type TaskCommentsQueryArgs = {
  queryKey: readonly [string, string, string | null]
  taskId: string | null
  supabase: SupabaseBrowserClient
}

export function useTaskCommentsQuery({
  queryKey,
  taskId,
  supabase,
}: TaskCommentsQueryArgs) {
  return useQuery({
    queryKey,
    enabled: Boolean(taskId),
    queryFn: async () => {
      if (!taskId) {
        return [] as TaskCommentWithAuthor[]
      }

      const { data, error } = await supabase
        .from('task_comments')
        .select(
          `
            id,
            task_id,
            author_id,
            body,
            created_at,
            updated_at,
            deleted_at,
            author:users (
              id,
              full_name,
              email
            )
          `
        )
        .eq('task_id', taskId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to load task comments', error)
        throw error
      }

      return (data ?? []) as TaskCommentWithAuthor[]
    },
  })
}

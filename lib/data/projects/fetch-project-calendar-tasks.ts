import type { SupabaseClient } from '@supabase/supabase-js'

import type { TaskWithRelations } from '@/lib/types'
import type { Database } from '@/supabase/types/database'

import { normalizeRawTask } from './normalize-task'
import type { RawTaskWithRelations } from './types'

type FetchProjectCalendarTasksArgs = {
  supabase: SupabaseClient<Database>
  projectId: string
  start: string
  end: string
}

export async function fetchProjectCalendarTasks({
  supabase,
  projectId,
  start,
  end,
}: FetchProjectCalendarTasksArgs): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `
        id,
        project_id,
        title,
        description,
        status,
        accepted_at,
        due_on,
        created_by,
        updated_by,
        created_at,
        updated_at,
        deleted_at,
        assignees:task_assignees (
          user_id,
          deleted_at
        ),
        comments:task_comments (
          id,
          deleted_at
        ),
        attachments:task_attachments (
          id,
          task_id,
          storage_path,
          original_name,
          mime_type,
          file_size,
          uploaded_by,
          created_at,
          updated_at,
          deleted_at
        )
      `
    )
    .eq('project_id', projectId)
    .gte('due_on', start)
    .lte('due_on', end)
    .is('deleted_at', null)
    .order('due_on', { ascending: true })

  if (error) {
    console.error('Failed to load project calendar tasks', error)
    throw error
  }

  const rows = (data ?? []) as RawTaskWithRelations[]

  const normalized = rows
    .filter(task => Boolean(task?.due_on))
    .map(task => normalizeRawTask(task))
    .filter(task => !(task.status === 'DONE' && task.accepted_at))

  normalized.sort((a, b) => {
    const dueA = a.due_on ?? ''
    const dueB = b.due_on ?? ''

    if (dueA !== dueB) {
      return dueA.localeCompare(dueB)
    }

    return a.title.localeCompare(b.title)
  })

  return normalized
}

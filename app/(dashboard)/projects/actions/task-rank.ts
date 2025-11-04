import type { SupabaseClient } from '@supabase/supabase-js'

import { getRankAfter } from '@/lib/rank'
import type { Database } from '@/supabase/types/database'
import { TASK_STATUSES } from './shared-schemas'

type TaskStatus = (typeof TASK_STATUSES)[number]

type Client = SupabaseClient<Database>

export async function resolveNextTaskRank(
  supabase: Client,
  projectId: string,
  status: TaskStatus
) {
  const { data, error } = await supabase
    .from('tasks')
    .select('rank')
    .eq('project_id', projectId)
    .eq('status', status)
    .is('deleted_at', null)
    .order('rank', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return getRankAfter(data?.rank ?? null)
}

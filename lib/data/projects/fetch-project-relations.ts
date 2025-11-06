import type { DbClient, DbProjectMember, DbTimeLog, DbUser } from '@/lib/types'

import type {
  ClientMembership,
  MemberWithUser,
  RawHourBlock,
  RawTaskWithRelations,
  SupabaseServiceClient,
} from './types'

export type ProjectRelationsFetchArgs = {
  projectIds: string[]
  clientIds: string[]
  shouldScopeToUser: boolean
  userId?: string
}

export type ProjectRelationsFetchResult = {
  clients: DbClient[]
  members: MemberWithUser[]
  tasks: RawTaskWithRelations[]
  hourBlocks: RawHourBlock[]
  timeLogs: DbTimeLog[]
  clientMemberships: ClientMembership[]
}

export async function fetchProjectRelations(
  supabase: SupabaseServiceClient,
  {
    projectIds,
    clientIds,
    shouldScopeToUser,
    userId,
  }: ProjectRelationsFetchArgs
): Promise<ProjectRelationsFetchResult> {
  const clientsPromise = clientIds.length
    ? supabase
        .from('clients')
        .select(
          `
            id,
            name,
            slug,
            notes,
            created_at,
            updated_at,
            deleted_at
          `
        )
        .in('id', clientIds)
    : Promise.resolve({ data: [], error: null })

  const membersPromise = projectIds.length
    ? supabase
        .from('project_members')
        .select(
          `
            id,
            project_id,
            user_id,
            created_at,
            deleted_at,
            user:users (
              id,
              email,
              full_name,
              role,
              avatar_url,
              created_at,
              updated_at,
              deleted_at
            )
          `
        )
        .in('project_id', projectIds)
    : Promise.resolve({ data: [], error: null })

  const tasksPromise = projectIds.length
    ? supabase
        .from('tasks')
        .select(
          `
            id,
            project_id,
            title,
            description,
            status,
            rank,
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
        .in('project_id', projectIds)
    : Promise.resolve({ data: [], error: null })

  const hourBlocksPromise = clientIds.length
    ? supabase
        .from('hour_blocks')
        .select(
          `
            id,
            client_id,
            hours_purchased,
            deleted_at
          `
        )
        .in('client_id', clientIds)
    : Promise.resolve({ data: [], error: null })

  const timeLogsPromise = projectIds.length
    ? supabase
        .from('time_logs')
        .select(
          `
            id,
            project_id,
            hours,
            logged_on,
            deleted_at
          `
        )
        .in('project_id', projectIds)
    : Promise.resolve({ data: [], error: null })

  const clientMembershipsPromise =
    shouldScopeToUser && userId
      ? supabase
          .from('client_members')
          .select('client_id, deleted_at')
          .eq('user_id', userId)
      : Promise.resolve({ data: [], error: null })

  const [
    { data: clientsData, error: clientsError },
    { data: membersData, error: membersError },
    { data: tasksData, error: tasksError },
    { data: hourBlocksData, error: hourBlocksError },
    { data: timeLogsData, error: timeLogsError },
    { data: clientMembershipsData, error: clientMembershipsError },
  ] = await Promise.all([
    clientsPromise,
    membersPromise,
    tasksPromise,
    hourBlocksPromise,
    timeLogsPromise,
    clientMembershipsPromise,
  ])

  if (clientsError) {
    console.error('Failed to load project clients', clientsError)
    throw clientsError
  }

  if (membersError) {
    console.error('Failed to load project members', membersError)
    throw membersError
  }

  if (tasksError) {
    console.error('Failed to load project tasks', tasksError)
    throw tasksError
  }

  if (hourBlocksError) {
    console.error('Failed to load hour blocks for burndown', hourBlocksError)
    throw hourBlocksError
  }

  if (timeLogsError) {
    console.error('Failed to load time logs for burndown', timeLogsError)
    throw timeLogsError
  }

  if (clientMembershipsError) {
    console.error(
      'Failed to load client memberships for scoping',
      clientMembershipsError
    )
    throw clientMembershipsError
  }

  return {
    clients: (clientsData ?? []) as DbClient[],
    members: (
      (membersData ?? []) as Array<DbProjectMember & { user: DbUser | null }>
    ).filter(Boolean) as MemberWithUser[],
    tasks: (tasksData ?? []) as RawTaskWithRelations[],
    hourBlocks: (hourBlocksData ?? []) as RawHourBlock[],
    timeLogs: (timeLogsData ?? []) as DbTimeLog[],
    clientMemberships: (clientMembershipsData ?? []) as ClientMembership[],
  }
}

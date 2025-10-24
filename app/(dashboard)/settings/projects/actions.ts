'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requireUser } from '@/lib/auth/session'
import { PROJECT_STATUS_ENUM_VALUES } from '@/lib/constants'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/supabase/types/database'

const projectSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Project name is required'),
    clientId: z.string().uuid('Select a client'),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    startsOn: z.string().nullable().optional(),
    endsOn: z.string().nullable().optional(),
    contractorIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsOn && data.endsOn) {
      const start = new Date(data.startsOn)
      const end = new Date(data.endsOn)

      if (
        !Number.isNaN(start.valueOf()) &&
        !Number.isNaN(end.valueOf()) &&
        end < start
      ) {
        ctx.addIssue({
          path: ['endsOn'],
          code: z.ZodIssueCode.custom,
          message: 'End date must be on or after the start date.',
        })
      }
    }
  })

const deleteSchema = z.object({ id: z.string().uuid() })

type ActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

type ProjectInput = z.infer<typeof projectSchema>

type DeleteInput = z.infer<typeof deleteSchema>

export async function saveProject(input: ProjectInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = projectSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const supabase = getSupabaseServerClient()
  const { id, name, clientId, status, startsOn, endsOn, contractorIds } =
    parsed.data
  const normalizedContractorIds = Array.from(new Set(contractorIds ?? []))

  if (!id) {
    const { data: inserted, error } = await supabase
      .from('projects')
      .insert({
        name,
        client_id: clientId,
        status,
        starts_on: startsOn ?? null,
        ends_on: endsOn ?? null,
        created_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (error || !inserted?.id) {
      console.error('Failed to create project', error)
      return { error: error?.message ?? 'Unable to create project.' }
    }

    const syncResult = await syncProjectContractors(
      supabase,
      inserted.id,
      normalizedContractorIds
    )

    if (syncResult.error) {
      return syncResult
    }
  } else {
    const { error } = await supabase
      .from('projects')
      .update({
        name,
        client_id: clientId,
        status,
        starts_on: startsOn ?? null,
        ends_on: endsOn ?? null,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to update project', error)
      return { error: error.message }
    }

    const syncResult = await syncProjectContractors(
      supabase,
      id,
      normalizedContractorIds
    )

    if (syncResult.error) {
      return syncResult
    }
  }

  revalidatePath('/settings/projects')

  return {}
}

export async function softDeleteProject(
  input: DeleteInput
): Promise<ActionResult> {
  await requireUser()
  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('Failed to archive project', error)
    return { error: error.message }
  }

  revalidatePath('/settings/projects')

  return {}
}

async function syncProjectContractors(
  supabase: SupabaseClient<Database>,
  projectId: string,
  contractorIds: string[]
): Promise<ActionResult> {
  const uniqueIds = Array.from(new Set(contractorIds))

  if (uniqueIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, deleted_at')
      .in('id', uniqueIds)

    if (usersError) {
      console.error('Failed to validate contractor assignments', usersError)
      return { error: 'Unable to validate selected contractors.' }
    }

    const invalidUsers = (users ?? []).filter(
      user => user.deleted_at !== null || user.role !== 'CONTRACTOR'
    )

    if (invalidUsers.length > 0) {
      return { error: 'Only active contractor users can be assigned.' }
    }
  }

  const { data: members, error: membersError } = await supabase
    .from('project_members')
    .select('id, user_id, deleted_at, user:users ( role, deleted_at )')
    .eq('project_id', projectId)

  if (membersError) {
    console.error('Failed to load existing project members', membersError)
    return { error: 'Unable to update project members.' }
  }

  const projectMembers = (members ?? []) as Array<
    Database['public']['Tables']['project_members']['Row'] & {
      user: {
        role: Database['public']['Enums']['user_role'] | null
        deleted_at: string | null
      } | null
    }
  >

  const uniqueSet = new Set(uniqueIds)
  const deletionTimestamp = new Date().toISOString()

  const archiveIds = projectMembers
    .filter(
      member =>
        member.user?.role === 'CONTRACTOR' &&
        member.deleted_at === null &&
        !uniqueSet.has(member.user_id)
    )
    .map(member => member.id)

  if (archiveIds.length > 0) {
    const { error: archiveError } = await supabase
      .from('project_members')
      .update({ deleted_at: deletionTimestamp })
      .in('id', archiveIds)

    if (archiveError) {
      console.error('Failed to archive removed contractors', archiveError)
      return { error: 'Unable to update project members.' }
    }
  }

  if (uniqueIds.length === 0) {
    return {}
  }

  const upsertPayload = uniqueIds.map(userId => ({
    project_id: projectId,
    user_id: userId,
    role: 'CONTRIBUTOR' as Database['public']['Enums']['member_role'],
    deleted_at: null,
  }))

  const { error: upsertError } = await supabase
    .from('project_members')
    .upsert(upsertPayload, { onConflict: 'project_id,user_id' })

  if (upsertError) {
    console.error('Failed to upsert contractor members', upsertError)
    return { error: 'Unable to update project members.' }
  }

  return {}
}

import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import {
  clientSchema,
  type ClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'
import { createClient } from './create-client'
import { updateClient } from './update-client'

export async function saveClientMutation(
  context: ClientMutationContext,
  input: ClientInput
): Promise<ClientMutationResult> {
  const parsed = clientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({
      error: parsed.error.issues[0]?.message ?? 'Invalid client payload.',
    })
  }

  const { id, name, slug, notes, memberIds } = parsed.data
  const normalizedMemberIds = Array.from(new Set(memberIds ?? [])).filter(
    Boolean
  )

  const trimmedName = name.trim()

  if (!trimmedName) {
    return buildMutationResult({ error: 'Name is required.' })
  }

  const cleanedNotes = notes?.trim() ? notes.trim() : null
  const providedSlug = slug?.trim() || null
  const mode = id ? 'edit' : 'create'

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode,
      targetId: id ?? null,
      metadata: {
        hasMembers: normalizedMemberIds.length > 0,
      },
    },
    async () => {
      if (!id) {
        return createClient(context, {
          name: trimmedName,
          providedSlug,
          notes: cleanedNotes,
          memberIds: normalizedMemberIds,
        })
      }

      return updateClient(context, {
        id,
        name: trimmedName,
        providedSlug,
        notes: cleanedNotes,
        memberIds: normalizedMemberIds,
      })
    }
  )
}

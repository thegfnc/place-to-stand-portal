'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import {
  type ClientActionResult,
  type ClientInput,
  type DeleteClientInput,
  type DestroyClientInput,
  type RestoreClientInput,
} from '@/lib/settings/clients/client-service'
import {
  destroyClientMutation,
  restoreClientMutation,
  saveClientMutation,
  softDeleteClientMutation,
} from '@/lib/settings/clients/actions'
import type {
  ClientMutationContext,
  ClientMutationResult,
} from '@/lib/settings/clients/actions'

const CLIENT_ROUTES_TO_REVALIDATE = [
  '/clients',
  '/clients/archive',
  '/clients/activity',
]

export async function saveClient(
  input: ClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, saveClientMutation)
}

export async function softDeleteClient(
  input: DeleteClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, softDeleteClientMutation)
}

export async function restoreClient(
  input: RestoreClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, restoreClientMutation)
}

export async function destroyClient(
  input: DestroyClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, destroyClientMutation)
}

async function runClientMutation<TInput>(
  input: TInput,
  mutate: (
    context: ClientMutationContext,
    payload: TInput
  ) => Promise<ClientMutationResult>
): Promise<ClientActionResult> {
  const user = await requireUser()
  const mutationResult = await mutate({ user }, input)
  const { didMutate, ...result } = mutationResult

  if (didMutate) {
    for (const path of CLIENT_ROUTES_TO_REVALIDATE) {
      revalidatePath(path)
    }
  }

  return result
}

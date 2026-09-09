'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser, type AppUser } from '@/lib/auth/session'
import { fetchClientById } from '@/lib/data/clients'
import { HttpError } from '@/lib/errors/http'
import { clientDetailHref, updateComposerHref } from '@/lib/sheets/hrefs'
import {
  sendClientUpdate,
  sendClientUpdateTest,
  updateClientUpdateDraft,
} from '@/lib/updates'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')

const itemSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().uuid().nullable(),
  label: z.string().trim().min(1, 'Every item needs a label').max(200),
  body: z.string().max(5000),
})

const saveDraftSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  intro: z.string().max(2000),
  items: z.array(itemSchema).max(50),
  closing: z.string().max(2000),
  recipients: z.object({
    to: z.array(emailSchema),
    cc: z.array(emailSchema),
  }),
})

export type SaveClientUpdateDraftInput = z.infer<typeof saveDraftSchema>

export type ClientUpdateActionResult =
  { success: true } | { success: false; error: string }

async function revalidateUpdate(user: AppUser, id: string, clientId: string) {
  revalidatePath(updateComposerHref(id))
  // Both the id and slug forms of the client page render the updates section.
  const client = await fetchClientById(user, clientId)
  revalidatePath(clientDetailHref(client))
  revalidatePath(clientDetailHref({ id: client.id, slug: null }))
}

export async function saveClientUpdateDraft(
  input: SaveClientUpdateDraftInput
): Promise<ClientUpdateActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = saveDraftSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const { id, ...draft } = parsed.data

  try {
    const updated = await updateClientUpdateDraft(id, draft)
    await revalidateUpdate(user, id, updated.clientId)
    return { success: true }
  } catch (error) {
    if (error instanceof HttpError)
      return { success: false, error: error.message }
    console.error('Failed to save client update draft:', error)
    return {
      success: false,
      error: 'Failed to save the draft. Please try again.',
    }
  }
}

export async function sendClientUpdateAction(input: {
  id: string
}): Promise<ClientUpdateActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid update id' }

  try {
    const sent = await sendClientUpdate(user, parsed.data.id)
    await revalidateUpdate(user, sent.id, sent.clientId)
    return { success: true }
  } catch (error) {
    if (error instanceof HttpError)
      return { success: false, error: error.message }
    console.error('Failed to send client update:', error)
    return {
      success: false,
      error:
        'Sending failed. The draft was not changed — check the Gmail connection and try again.',
    }
  }
}

export type SendTestResult =
  { success: true; to: string } | { success: false; error: string }

/** Mails the current draft to whoever is pressing the button; the row is not changed. */
export async function sendClientUpdateTestAction(input: {
  id: string
}): Promise<SendTestResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid update id' }

  try {
    const { to } = await sendClientUpdateTest(user, parsed.data.id)
    return { success: true, to }
  } catch (error) {
    if (error instanceof HttpError)
      return { success: false, error: error.message }
    console.error('Failed to send client update test:', error)
    return {
      success: false,
      error: 'The test could not be sent — check the Gmail connection.',
    }
  }
}

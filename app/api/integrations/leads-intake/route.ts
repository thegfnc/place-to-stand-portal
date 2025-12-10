import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'
import type {
  LeadSourceTypeValue,
  LeadStatusValue,
} from '@/lib/leads/constants'

const DEFAULT_STATUS: LeadStatusValue = 'NEW_OPPORTUNITIES'
const SOURCE_TYPE_WEBSITE: LeadSourceTypeValue = 'WEBSITE'
const SOURCE_DETAIL_FALLBACK = 'https://placetostandagency.com/'

const payloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email(),
  company: z.string().trim().max(160).optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  message: z.string().trim().max(5000).optional().nullable(),
  sourceDetail: z.string().trim().max(255).optional().nullable(),
})

type IntakePayload = z.infer<typeof payloadSchema>

export async function POST(request: NextRequest) {
  const configuredToken = process.env.LEADS_INTAKE_TOKEN

  if (!configuredToken) {
    console.error('LEADS_INTAKE_TOKEN is not configured')
    return NextResponse.json(
      { error: 'Lead intake is not configured.' },
      { status: 500 }
    )
  }

  const providedAuth = request.headers.get('authorization')

  if (!providedAuth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providedToken = providedAuth.slice('Bearer '.length).trim()

  if (providedToken !== configuredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for leads intake', error)
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  const parsed = payloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    await upsertLeadFromPayload(data)
  } catch (error) {
    console.error('Failed to create lead from intake', error)
    return NextResponse.json(
      { error: 'Unable to record lead.' },
      { status: 500 }
    )
  }

  revalidatePath('/leads/board')
  return NextResponse.json({ ok: true }, { status: 201 })
}

async function upsertLeadFromPayload(payload: IntakePayload) {
  const rank = await resolveNextLeadRank(DEFAULT_STATUS)
  const timestamp = new Date().toISOString()
  const trimmedCompany = payload.company?.trim() || null
  const trimmedWebsite = payload.website?.trim() || null
  const trimmedMessage = payload.message?.trim() ?? ''
  const notesHtml = trimmedMessage ? buildNotesHtml(trimmedMessage) : ''

  await db.insert(leads).values({
    contactName: payload.name.trim(),
    contactEmail: payload.email.trim(),
    contactPhone: null,
    companyName: trimmedCompany,
    companyWebsite: trimmedWebsite,
    status: DEFAULT_STATUS,
    sourceType: SOURCE_TYPE_WEBSITE,
    sourceDetail: payload.sourceDetail?.trim() || SOURCE_DETAIL_FALLBACK,
    assigneeId: null,
    notes: serializeLeadNotes(notesHtml),
    rank,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

function buildNotesHtml(message: string) {
  const escaped = escapeHtml(message)
  const withBreaks = escaped.replace(/\r?\n/g, '<br />')
  return `<p><strong>Customer message via contact form:</strong></p><p>${withBreaks}</p>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

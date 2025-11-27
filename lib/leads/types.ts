import type { LeadStatusValue } from './constants'

export type LeadRecord = {
  id: string
  name: string
  status: LeadStatusValue
  source: string | null
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
  contactEmail: string | null
  contactPhone: string | null
  notesHtml: string
  rank: string
  createdAt: string
  updatedAt: string
}

export type LeadBoardColumnData = {
  id: LeadStatusValue
  label: string
  description: string
  leads: LeadRecord[]
}

export type LeadOwnerOption = {
  id: string
  name: string
  email: string | null
}


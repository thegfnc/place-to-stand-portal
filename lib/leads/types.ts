import type { LeadSourceTypeValue, LeadStatusValue } from './constants'

export type LeadRecord = {
  id: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeEmail: string | null
  assigneeAvatarUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
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

export type LeadAssigneeOption = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}

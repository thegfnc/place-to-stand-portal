import type { leadStatus } from '@/lib/db/schema'

/**
 * Lead status values as defined in the database enum.
 * These correspond to the Kanban columns in the leads view.
 */
export type LeadStatusValue = (typeof leadStatus.enumValues)[number]

/**
 * Definition for a lead board column.
 */
export type LeadBoardColumn = {
  id: LeadStatusValue
  label: string
  description: string
}

/**
 * Ordered list of columns for the leads Kanban board.
 * The order matches the sales funnel progression.
 */
export const LEAD_BOARD_COLUMNS: readonly LeadBoardColumn[] = [
  {
    id: 'NEW_OPPORTUNITIES',
    label: 'New Opportunities',
    description: 'Fresh leads that have not been qualified',
  },
  {
    id: 'ACTIVE_OPPORTUNITIES',
    label: 'Active Opportunities',
    description: 'Qualified leads being actively engaged',
  },
  {
    id: 'PROPOSAL_SENT',
    label: 'Proposal Sent',
    description: 'Leads to whom a proposal has been delivered',
  },
  {
    id: 'ON_ICE',
    label: 'On Ice',
    description: 'Leads that have gone unresponsive or requested follow-up later',
  },
  {
    id: 'CLOSED_WON',
    label: 'Closed Won',
    description: 'Deals successfully closed',
  },
  {
    id: 'CLOSED_LOST',
    label: 'Closed Lost',
    description: 'Opportunities that did not convert',
  },
] as const

/**
 * Get the display label for a lead status.
 */
export function getLeadStatusLabel(status: LeadStatusValue): string {
  const column = LEAD_BOARD_COLUMNS.find(col => col.id === status)
  return column?.label ?? status
}

/**
 * Get the description for a lead status.
 */
export function getLeadStatusDescription(status: LeadStatusValue): string {
  const column = LEAD_BOARD_COLUMNS.find(col => col.id === status)
  return column?.description ?? ''
}

/**
 * Check if a status represents an open (active) lead.
 */
export function isOpenLeadStatus(status: LeadStatusValue): boolean {
  return (
    status === 'NEW_OPPORTUNITIES' ||
    status === 'ACTIVE_OPPORTUNITIES' ||
    status === 'PROPOSAL_SENT' ||
    status === 'ON_ICE'
  )
}

/**
 * Check if a status represents a closed lead.
 */
export function isClosedLeadStatus(status: LeadStatusValue): boolean {
  return status === 'CLOSED_WON' || status === 'CLOSED_LOST'
}



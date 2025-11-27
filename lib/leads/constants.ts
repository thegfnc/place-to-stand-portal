import { leadStatus } from '@/lib/db/schema'
import { TASK_STATUS_TOKENS } from '@/lib/projects/task-status'

export const LEAD_STATUS_VALUES = leadStatus.enumValues

export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW_OPPORTUNITIES: 'New Opportunities',
  ACTIVE_OPPORTUNITIES: 'Active Opportunities',
  PROPOSAL_SENT: 'Proposal Sent',
  ON_ICE: 'On Ice',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
  UNQUALIFIED: 'Unqualified',
}

export const LEAD_STATUS_TOKENS: Record<LeadStatusValue, string> = {
  NEW_OPPORTUNITIES:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  ACTIVE_OPPORTUNITIES:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  PROPOSAL_SENT:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  ON_ICE:
    'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  CLOSED_WON:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  CLOSED_LOST:
    'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  UNQUALIFIED: TASK_STATUS_TOKENS.ACCEPTED,
}

export const LEAD_BOARD_COLUMNS = [
  {
    id: 'NEW_OPPORTUNITIES',
    label: LEAD_STATUS_LABELS.NEW_OPPORTUNITIES,
    description: 'Fresh leads awaiting qualification.',
  },
  {
    id: 'ACTIVE_OPPORTUNITIES',
    label: LEAD_STATUS_LABELS.ACTIVE_OPPORTUNITIES,
    description: 'Qualified leads with active engagement.',
  },
  {
    id: 'PROPOSAL_SENT',
    label: LEAD_STATUS_LABELS.PROPOSAL_SENT,
    description: 'Leads that have received a proposal.',
  },
  {
    id: 'ON_ICE',
    label: LEAD_STATUS_LABELS.ON_ICE,
    description: 'Paused leads that may resume later.',
  },
  {
    id: 'CLOSED_WON',
    label: LEAD_STATUS_LABELS.CLOSED_WON,
    description: 'Leads that converted successfully.',
  },
  {
    id: 'CLOSED_LOST',
    label: LEAD_STATUS_LABELS.CLOSED_LOST,
    description: 'Leads that did not convert.',
  },
  {
    id: 'UNQUALIFIED',
    label: LEAD_STATUS_LABELS.UNQUALIFIED,
    description: 'Leads that are no longer a fit or disqualified.',
  },
] as const satisfies ReadonlyArray<{
  id: LeadStatusValue
  label: string
  description: string
}>

export const LEAD_STATUS_ORDER = LEAD_BOARD_COLUMNS.map(column => column.id)

export function getLeadStatusLabel(status: LeadStatusValue): string {
  return LEAD_STATUS_LABELS[status] ?? status
}

export function getLeadStatusToken(status: LeadStatusValue): string {
  return LEAD_STATUS_TOKENS[status] ?? ''
}

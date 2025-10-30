const TASK_STATUS_METADATA = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'ON_DECK', label: 'On Deck' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'BLOCKED', label: 'Blocked' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'DONE', label: 'Done' },
] as const

const [
  BACKLOG_STATUS,
  ON_DECK_STATUS,
  IN_PROGRESS_STATUS,
  BLOCKED_STATUS,
  IN_REVIEW_STATUS,
  DONE_STATUS,
] = TASK_STATUS_METADATA

export const BOARD_COLUMNS = [
  ON_DECK_STATUS,
  IN_PROGRESS_STATUS,
  BLOCKED_STATUS,
  IN_REVIEW_STATUS,
  DONE_STATUS,
] as const

export const BACKLOG_SECTIONS = [ON_DECK_STATUS, BACKLOG_STATUS] as const

export type BoardColumnId = (typeof TASK_STATUS_METADATA)[number]['id']

export const BOARD_BASE_PATH = '/projects'

export const MISSING_SLUG_MESSAGE =
  'This project is missing a slug. Update it in Settings -> Projects.'

export const NO_CLIENT_PROJECTS_MESSAGE =
  'This client does not have any projects yet.'

export const BOARD_COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'ON_DECK', label: 'On Deck' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'BLOCKED', label: 'Blocked' },
  { id: 'DONE', label: 'Done' },
] as const

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]['id']

export const BOARD_BASE_PATH = '/projects'

export const MISSING_SLUG_MESSAGE =
  'This project is missing a slug. Update it in Settings -> Projects.'

export const NO_CLIENT_PROJECTS_MESSAGE =
  'This client does not have any projects yet.'

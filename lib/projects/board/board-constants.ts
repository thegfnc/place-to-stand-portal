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

export const NO_PROJECTS_MESSAGE = 'No projects are available yet.'

export const BOARD_VIEW_SEGMENTS = {
  board: 'board',
  calendar: 'calendar',
  backlog: 'backlog',
  activity: 'activity',
  review: 'review',
  timeLogs: 'time-logs',
} as const

export type BoardView = keyof typeof BOARD_VIEW_SEGMENTS

const BOARD_VIEW_ENTRIES = Object.entries(BOARD_VIEW_SEGMENTS) as Array<
  [BoardView, string]
>

const BOARD_VIEW_SEGMENT_MAP = new Map<string, BoardView>(
  BOARD_VIEW_ENTRIES.map(([view, segment]) => [segment, view])
)

const BOARD_VIEW_SET = new Set<BoardView>(
  BOARD_VIEW_ENTRIES.map(([view]) => view)
)

export const isBoardView = (value: string): value is BoardView =>
  BOARD_VIEW_SET.has(value as BoardView)

export const getBoardViewFromPathname = (
  pathname: string
): BoardView | null => {
  const segments = pathname.split('?')[0]?.split('/').filter(Boolean) ?? []
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const match = BOARD_VIEW_SEGMENT_MAP.get(segments[index]) ?? null
    if (match) {
      return match
    }
  }
  return null
}

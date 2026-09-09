export { createUpdateDraft, type DraftItemInput } from './create-draft'
export { buildUpdateEmailContent } from './content'
export { DEFAULT_CLOSING, DEFAULT_INTRO, formatHours } from './body'
export {
  fetchClientUpdate,
  listClientUpdates,
  updateClientUpdateDraft,
} from './queries'
export {
  sendClientUpdate,
  sendClientUpdateTest,
  RECONNECT_GOOGLE_MESSAGE,
} from './send'
export { fetchActiveStaff, type StaffMember } from './staff'
export type {
  ClientUpdateItem,
  ClientUpdateRecipients,
  ClientUpdateRow,
  ClientUpdateStatus,
} from './types'

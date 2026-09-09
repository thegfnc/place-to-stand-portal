import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

/**
 * Emitted by the worker-status poll only on a real transition. The poll
 * itself runs constantly and rewrites the same status; logging every pass
 * would bury the feed in no-op rows.
 */
export const taskWorkerStatusChangedEvent = (args: {
  taskTitle: string
  issueNumber: number
  before: string | null
  after: string
}): ActivityEvent => ({
  verb: ActivityVerbs.TASK_WORKER_STATUS_CHANGED,
  summary: `Worker status on "${args.taskTitle}" changed from ${
    args.before ?? 'none'
  } to ${args.after} (#${args.issueNumber})`,
  metadata: toMetadata({
    changedFields: ['workerStatus'],
    details: {
      before: { workerStatus: args.before },
      after: { workerStatus: args.after },
    },
    issueNumber: args.issueNumber,
  }),
})

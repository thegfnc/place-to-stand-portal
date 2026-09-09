import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const planningSessionCreatedEvent = (args: {
  taskId: string
  taskTitle: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PLANNING_SESSION_CREATED,
  summary: `Started a planning session for "${args.taskTitle}"`,
  metadata: toMetadata({ taskId: args.taskId, title: args.taskTitle }),
})

/**
 * Emitted once per finished generation, never for the partial-content
 * autosaves that stream in while the model is still writing.
 */
export const planRevisionCreatedEvent = (args: {
  taskTitle: string
  threadId: string
  version: number
  model: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PLAN_REVISION_CREATED,
  summary: `Generated plan v${args.version} for "${args.taskTitle}"`,
  metadata: toMetadata({
    threadId: args.threadId,
    version: args.version,
    model: args.model,
  }),
})

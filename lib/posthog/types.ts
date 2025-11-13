export const INTERACTION_EVENTS = {
  TASK_SHEET_OPEN: "task_sheet.open",
  DASHBOARD_REFRESH: "dashboard.refresh",
  SETTINGS_SAVE: "settings.save",
  ROUTER_TRANSITION: "router.transition",
} as const;

export type InteractionEventName =
  (typeof INTERACTION_EVENTS)[keyof typeof INTERACTION_EVENTS];

export type PostHogEventProperties = Record<string, unknown>;


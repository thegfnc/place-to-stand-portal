export const INTERACTION_EVENTS = {
  TASK_SHEET_OPEN: "task_sheet.open",
  DASHBOARD_REFRESH: "dashboard.refresh",
  SETTINGS_SAVE: "settings.save",
  ROUTER_TRANSITION: "router.transition",
  BOARD_TAB_SWITCH: "board.tab_switch",
  IDLE_RESUME: "idle.resume",
} as const;

export type InteractionEventName =
  (typeof INTERACTION_EVENTS)[keyof typeof INTERACTION_EVENTS];

export type PostHogEventProperties = Record<string, unknown>;


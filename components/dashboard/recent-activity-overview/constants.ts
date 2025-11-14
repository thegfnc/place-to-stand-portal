export const TIMEFRAME_OPTIONS = [
  { value: "1", label: "1d", description: "Last 1 day" },
  { value: "7", label: "7d", description: "Last 7 days" },
  { value: "14", label: "14d", description: "Last 14 days" },
  { value: "28", label: "28d", description: "Last 28 days" },
] as const

export type TimeframeOption = (typeof TIMEFRAME_OPTIONS)[number]
export type TimeframeValue = TimeframeOption["value"]

export const DEFAULT_TIMEFRAME_VALUE: TimeframeValue =
  TIMEFRAME_OPTIONS[0].value


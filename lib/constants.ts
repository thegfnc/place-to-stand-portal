export const PROJECT_STATUS_ENUM_VALUES = ["active", "on_hold", "completed"] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_ENUM_VALUES)[number];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatusValue;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

export const PROJECT_STATUS_VALUES = [...PROJECT_STATUS_ENUM_VALUES];

export function getProjectStatusLabel(value: string): string {
  const match = PROJECT_STATUS_OPTIONS.find((option) => option.value === value);
  if (match) {
    return match.label;
  }

  const normalized = value.replace(/_/g, " ").trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const PROJECT_STATUS_TOKENS: Record<ProjectStatusValue, string> = {
  active:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
  on_hold:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  completed:
    "border-transparent bg-slate-200 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200",
};

export function getProjectStatusToken(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized in PROJECT_STATUS_TOKENS) {
    return PROJECT_STATUS_TOKENS[normalized as ProjectStatusValue];
  }

  return "border border-border bg-accent text-accent-foreground";
}

export const STATUS_BADGE_TOKENS = {
  active: PROJECT_STATUS_TOKENS.active,
  depleted:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  archived:
    "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300",
  inactive:
    "border-transparent bg-slate-200 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200",
} as const;

export type StatusBadgeValue = keyof typeof STATUS_BADGE_TOKENS;

export function getStatusBadgeToken(value: string): string {
  const normalized = value.toLowerCase() as StatusBadgeValue;
  if (normalized in STATUS_BADGE_TOKENS) {
    return STATUS_BADGE_TOKENS[normalized];
  }

  return "border border-border bg-accent text-accent-foreground";
}

export const HOUR_BLOCK_TYPE_ENUM_VALUES = ["RETAINER", "PROJECT", "MAINTENANCE"] as const;

export type HourBlockTypeValue = (typeof HOUR_BLOCK_TYPE_ENUM_VALUES)[number];

export const HOUR_BLOCK_TYPE_OPTIONS: ReadonlyArray<{
  value: HourBlockTypeValue;
  label: string;
}> = [
  { value: "RETAINER", label: "Retainer" },
  { value: "PROJECT", label: "Project" },
  { value: "MAINTENANCE", label: "Maintenance" },
];

export const HOUR_BLOCK_TYPE_VALUES = [...HOUR_BLOCK_TYPE_ENUM_VALUES];

export function getHourBlockTypeLabel(value: string): string {
  const match = HOUR_BLOCK_TYPE_OPTIONS.find((option) => option.value === value);
  if (match) {
    return match.label;
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

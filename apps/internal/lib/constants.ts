export const PROJECT_STATUS_ENUM_VALUES = ["ONBOARDING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_ENUM_VALUES)[number];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatusValue;
  label: string;
}> = [
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
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

const PROJECT_STATUS_TOKENS: Record<ProjectStatusValue, string> = {
  ONBOARDING:
    "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300",
  ACTIVE:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
  ON_HOLD:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  COMPLETED:
    "border-transparent bg-slate-200 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200",
};

export function getProjectStatusToken(value: string): string {
  const upperValue = value.toUpperCase();
  if (upperValue in PROJECT_STATUS_TOKENS) {
    return PROJECT_STATUS_TOKENS[upperValue as ProjectStatusValue];
  }

  return "border border-border bg-accent text-accent-foreground";
}

const STATUS_BADGE_TOKENS = {
  active: PROJECT_STATUS_TOKENS.ACTIVE,
  depleted:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  archived:
    "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300",
  inactive:
    "border-transparent bg-slate-200 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200",
} as const;

type StatusBadgeValue = keyof typeof STATUS_BADGE_TOKENS;

export function getStatusBadgeToken(value: string): string {
  const normalized = value.toLowerCase() as StatusBadgeValue;
  if (normalized in STATUS_BADGE_TOKENS) {
    return STATUS_BADGE_TOKENS[normalized];
  }

  return "border border-border bg-accent text-accent-foreground";
}

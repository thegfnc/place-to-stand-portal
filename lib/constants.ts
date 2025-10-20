export const PROJECT_STATUS_ENUM_VALUES = ["active", "on_hold", "completed", "archived"] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_ENUM_VALUES)[number];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatusValue;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
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

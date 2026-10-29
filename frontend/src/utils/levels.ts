import { ClassRoom } from "../types";

export const LEVELS = [
  { value: "nursery", label: "Nursery" },
  { value: "primary", label: "Primary" },
  { value: "junior_secondary", label: "Junior Secondary" },
  { value: "senior_secondary", label: "Senior Secondary" }
] as const;

// Classes grouped by school section, in teaching order; classes with no level go last.
export function groupByLevel(classes: ClassRoom[]): { level: string; label: string; items: ClassRoom[] }[] {
  const groups = LEVELS.map((l) => ({ level: l.value as string, label: l.label as string, items: classes.filter((c) => c.level === l.value) }));
  const other = classes.filter((c) => !c.level || !LEVELS.some((l) => l.value === c.level));
  if (other.length) groups.push({ level: "other", label: "Other classes", items: other });
  return groups.filter((g) => g.items.length > 0);
}

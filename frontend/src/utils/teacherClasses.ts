import { ClassRoom } from "../types";

// A teacher only works in the classes the admin assigned to them; everyone else sees all classes.
export function classesForUser(user: { role?: string; classIds?: string[] } | null | undefined, all: ClassRoom[]): ClassRoom[] {
  if (user?.role !== "teacher") return all;
  const mine = new Set(user.classIds || []);
  return all.filter((c) => mine.has(c._id));
}

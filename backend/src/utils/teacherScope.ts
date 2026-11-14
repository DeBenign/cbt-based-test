import User from "../models/User";

// What a teacher may touch: a class is only theirs if the admin assigned it to them, and a
// subject is only theirs if it is on their list. A (subject, class) pair is allowed when both are.
export interface TeacherScope {
  subjectIds: string[];
  classIds: string[];
}

// Busy teachers hit several endpoints per page, so the lookup is cached briefly per instance.
// forgetTeacherScope() is called whenever an admin changes someone's assignments.
const TTL_MS = 15_000;
const MAX_ENTRIES = 2000;
const cache = new Map<string, { scope: TeacherScope; expires: number }>();

export function forgetTeacherScope(userId: string) {
  cache.delete(String(userId));
}

export function clearTeacherScopeCache() {
  cache.clear();
}

export async function loadTeacherScope(userId: string): Promise<TeacherScope> {
  const now = Date.now();
  const hit = cache.get(String(userId));
  if (hit && hit.expires > now) return hit.scope;

  const t = await User.findById(userId).select("subjectIds classIds").lean();
  const scope: TeacherScope = {
    subjectIds: (t?.subjectIds || []).map(String),
    classIds: (t?.classIds || []).map(String)
  };
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(String(userId), { scope, expires: now + TTL_MS });
  return scope;
}

export function inScope(scope: TeacherScope, subjectId: unknown, classId: unknown): boolean {
  return scope.subjectIds.includes(String(subjectId)) && scope.classIds.includes(String(classId));
}

// null when allowed; otherwise a message that tells the teacher what to ask the admin for.
export function denyReason(scope: TeacherScope, subjectId: unknown, classId: unknown): string | null {
  if (!scope.subjectIds.includes(String(subjectId))) return "You're not assigned to this subject.";
  if (scope.classIds.length === 0) return "You haven't been assigned any classes yet. Ask your school admin to assign them.";
  if (!scope.classIds.includes(String(classId))) return "You're not assigned to this class.";
  return null;
}

// Mongo filter limiting a query to the teacher's own subjects and classes.
export function scopeFilter(scope: TeacherScope) {
  return { subjectId: { $in: scope.subjectIds }, classId: { $in: scope.classIds } };
}

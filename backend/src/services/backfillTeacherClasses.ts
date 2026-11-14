import { Types } from "mongoose";
import User from "../models/User";
import Subject from "../models/Subject";

// Teachers created before classes could be assigned have no "classIds" field at all.
// Left alone they would lose access to everything, so each is given the classes their
// subjects are already linked to (exactly what they could use before). The admin then
// narrows them in Manage users. Teachers who already have the field (even an empty list,
// meaning "none yet") are never touched, so this is safe to run any number of times.
export async function backfillTeacherClasses(): Promise<{ updated: number }> {
  const legacy = await User.collection.find({ role: "teacher", classIds: { $exists: false } }).project({ _id: 1, schoolId: 1, subjectIds: 1 }).toArray();
  if (legacy.length === 0) return { updated: 0 };

  const subjectIds = [...new Set(legacy.flatMap((t: any) => (t.subjectIds || []).map(String)))];
  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("classIds").lean();
  const classesOf = new Map(subjects.map((s) => [String(s._id), (s.classIds || []).map(String)]));

  const ops = legacy.map((t: any) => {
    const ids = [...new Set((t.subjectIds || []).flatMap((s: any) => classesOf.get(String(s)) || []))];
    return { updateOne: { filter: { _id: t._id }, update: { $set: { classIds: ids.map((id) => new Types.ObjectId(String(id))) } } } };
  });
  await User.collection.bulkWrite(ops as any);
  return { updated: ops.length };
}

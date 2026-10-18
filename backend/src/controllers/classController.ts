import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Class from "../models/Class";
import User from "../models/User";
import Exam from "../models/Exam";

export async function createClass(req: AuthedRequest, res: Response) {
  const { name, academicYear } = req.body;
  const klass = await Class.create({
    schoolId: req.user!.schoolId,
    name,
    academicYear
  });
  res.status(201).json(klass);
}

export async function listClasses(req: AuthedRequest, res: Response) {
  const classes = await Class.find({ schoolId: req.user!.schoolId }).sort({ name: 1 });
  res.json(classes);
}

export async function deleteClass(req: AuthedRequest, res: Response) {
  const klass = await Class.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!klass) return res.status(404).json({ error: "Class not found" });

  const [studentCount, examCount] = await Promise.all([
    User.countDocuments({ classId: klass._id }),
    Exam.countDocuments({ classId: klass._id })
  ]);

  if (studentCount > 0 || examCount > 0) {
    return res.status(409).json({
      error: `Can't delete -- ${studentCount} student(s) and ${examCount} exam(s) still reference this class. Reassign or remove those first.`
    });
  }

  await klass.deleteOne();
  res.status(204).send();
}
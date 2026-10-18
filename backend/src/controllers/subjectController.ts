import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Subject from "../models/Subject";
import Question from "../models/Question";
import Exam from "../models/Exam";
import User from "../models/User";

export async function createSubject(req: AuthedRequest, res: Response) {
  const { name, classIds } = req.body;
  const subject = await Subject.create({
    schoolId: req.user!.schoolId,
    name,
    classIds: classIds || []
  });
  res.status(201).json(subject);
}

export async function listSubjects(req: AuthedRequest, res: Response) {
  const subjects = await Subject.find({ schoolId: req.user!.schoolId }).sort({ name: 1 });
  res.json(subjects);
}

export async function updateSubject(req: AuthedRequest, res: Response) {
  const { classIds } = req.body;
  const subject = await Subject.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.user!.schoolId },
    { classIds },
    { new: true }
  );
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  res.json(subject);
}

export async function deleteSubject(req: AuthedRequest, res: Response) {
  const subject = await Subject.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!subject) return res.status(404).json({ error: "Subject not found" });

  const [questionCount, examCount, teacherCount] = await Promise.all([
    Question.countDocuments({ subjectId: subject._id }),
    Exam.countDocuments({ subjectId: subject._id }),
    User.countDocuments({ subjectIds: subject._id })
  ]);

  if (questionCount > 0 || examCount > 0 || teacherCount > 0) {
    return res.status(409).json({
      error: `Can't delete -- ${questionCount} question(s), ${examCount} exam(s), and ${teacherCount} teacher(s) still reference this subject.`
    });
  }

  await subject.deleteOne();
  res.status(204).send();
}
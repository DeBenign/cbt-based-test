import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Curriculum from "../models/Curriculum";
import Class from "../models/Class";
import Subject from "../models/Subject";
import { loadTeacherScope, denyReason } from "../utils/teacherScope";
import { detectSourceType, extractText, splitIntoTopics, SourceType } from "../utils/curriculumParser";

// Admin: any class/subject in the school. Teacher: only their own subjects AND classes.
async function denyManage(req: AuthedRequest, subjectId: unknown, classId: unknown): Promise<string | null> {
  if (req.user!.role === "admin") return null;
  return denyReason(await loadTeacherScope(req.user!.userId), subjectId, classId);
}

export async function uploadCurriculum(req: AuthedRequest, res: Response) {
  const { classId, subjectId, title, text } = req.body as {
    classId?: string; subjectId?: string; title?: string; text?: string;
  };
  const file = (req as any).file as { originalname: string; mimetype: string; buffer: Buffer } | undefined;

  if (!classId || !subjectId || !title?.trim()) {
    return res.status(400).json({ error: "Class, subject and a title are required." });
  }
  if (!file && !(text && text.trim())) {
    return res.status(400).json({ error: "Attach a PDF, Word (.docx) or text file, or paste the curriculum text." });
  }

  const [cls, subject] = await Promise.all([
    Class.findOne({ _id: classId, schoolId: req.user!.schoolId }),
    Subject.findOne({ _id: subjectId, schoolId: req.user!.schoolId })
  ]);
  if (!cls) return res.status(404).json({ error: "Class not found." });
  if (!subject) return res.status(404).json({ error: "Subject not found." });
  const denied = await denyManage(req, subjectId, classId);
  if (denied) {
    return res.status(403).json({ error: denied });
  }

  let sourceType: SourceType = "text";
  let raw = text || "";
  if (file) {
    const detected = detectSourceType(file.originalname, file.mimetype);
    if (!detected) return res.status(400).json({ error: "Unsupported file type. Use PDF, .docx or .txt." });
    sourceType = detected;
    try {
      raw = await extractText(file.buffer, detected);
    } catch {
      return res.status(422).json({ error: "Couldn't read that file. If it's a scanned PDF (images of pages), paste the text instead." });
    }
  }

  const topics = splitIntoTopics(raw);
  const charCount = topics.reduce((n, t) => n + t.text.length, 0);
  if (topics.length === 0 || charCount < 100) {
    return res.status(422).json({ error: "Almost no readable text was found. Scanned PDFs need to be pasted as text." });
  }

  const doc = await Curriculum.create({
    schoolId: req.user!.schoolId,
    classId,
    subjectId,
    title: title.trim(),
    fileName: file?.originalname,
    sourceType,
    charCount,
    topics,
    uploadedBy: req.user!.userId
  });

  res.status(201).json({
    _id: doc._id,
    title: doc.title,
    topicCount: topics.length,
    charCount,
    topics: topics.map((t) => t.title)
  });
}

export async function listCurricula(req: AuthedRequest, res: Response) {
  const { classId, subjectId } = req.query;
  const filter: Record<string, unknown> = { schoolId: req.user!.schoolId };
  if (classId) filter.classId = classId;
  if (subjectId) filter.subjectId = subjectId;
  if (req.user!.role === "teacher") {
    const scope = await loadTeacherScope(req.user!.userId);
    filter.subjectId = subjectId ? { $in: scope.subjectIds.filter((id) => id === String(subjectId)) } : { $in: scope.subjectIds };
    filter.classId = classId ? { $in: scope.classIds.filter((id) => id === String(classId)) } : { $in: scope.classIds };
  }

  const items = await Curriculum.find(filter).select("-topics.text").sort({ createdAt: -1 });
  res.json(
    items.map((c) => ({
      _id: c._id,
      classId: c.classId,
      subjectId: c.subjectId,
      title: c.title,
      fileName: c.fileName,
      sourceType: c.sourceType,
      charCount: c.charCount,
      topics: c.topics.map((t) => t.title),
      createdAt: c.createdAt
    }))
  );
}

export async function deleteCurriculum(req: AuthedRequest, res: Response) {
  const doc = await Curriculum.findOne({ _id: req.params.id, schoolId: req.user!.schoolId });
  if (!doc) return res.status(404).json({ error: "Curriculum not found." });
  const denied = await denyManage(req, doc.subjectId, doc.classId);
  if (denied) return res.status(403).json({ error: denied });
  await doc.deleteOne();
  res.status(204).send();
}

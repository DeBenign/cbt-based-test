export interface Subject {
  _id: string;
  name: string;
  classIds: string[];
}

export interface ClassRoom {
  _id: string;
  name: string;
  academicYear: string;
}

export interface AppUser {
  _id: string;
  name: string;
  email: string;
  username?: string;
  role: "superadmin" | "admin" | "teacher" | "student";
  classId?: string;
  subjectIds?: string[];
  createdAt: string;
}

export interface Question {
  _id: string;
  subjectId: string;
  classId: string;
  topic: string;
  type: "mcq" | "theory";
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  correctAnswerText?: string;
  marks: number;
  curriculumTag?: string;
  reviewStatus?: "draft" | "approved";
  source?: "manual" | "ai";
}

export interface CurriculumItem {
  _id: string;
  classId: string;
  subjectId: string;
  title: string;
  fileName?: string;
  sourceType: "pdf" | "docx" | "text";
  charCount: number;
  topics: string[];
  createdAt: string;
}

export interface Exam {
  _id: string;
  subjectId: string;
  classId: string;
  title: string;
  questionIds: string[];
  duration: number;
  startTime: string;
  endTime: string;
  status: "draft" | "scheduled" | "live" | "closed";
  lockdownRequired?: boolean;
}
import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import User from "../models/User";
import Class from "../models/Class";
import Subject from "../models/Subject";
import { generatePassword, usernameBase, reserveUsername, syntheticEmail } from "../utils/credentials";
import { logActivity } from "../utils/activity";

// Small on purpose: bcrypt is slow by design and this runs as a serverless
// function. The frontend splits big files into batches of this size.
export const MAX_BULK_BATCH = 40;

interface BulkRow {
  rowNumber?: number;
  name?: string;
  role?: string;
  email?: string;
  class?: string;
  subjects?: string;
}

interface RowResult {
  rowNumber: number;
  name: string;
  role: string;
  className?: string;
  username?: string;
  email?: string;
  password?: string;
  status: "created" | "skipped" | "error";
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function bulkCreateUsers(req: AuthedRequest, res: Response) {
  const { rows, defaultRole, allowDuplicates } = req.body as {
    rows: BulkRow[];
    defaultRole?: string;
    allowDuplicates?: boolean;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No rows to import." });
  }
  if (rows.length > MAX_BULK_BATCH) {
    return res.status(400).json({ error: `Send at most ${MAX_BULK_BATCH} rows per request.` });
  }

  const schoolId = req.user!.schoolId;
  const [classes, subjects] = await Promise.all([Class.find({ schoolId }), Subject.find({ schoolId })]);
  const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));
  const subjectByName = new Map(subjects.map((s) => [s.name.trim().toLowerCase(), s]));

  const results: RowResult[] = [];
  const emailsInBatch = new Set<string>();
  const usernamesInBatch = new Set<string>();
  const toCreate: { result: RowResult; doc: any; plain: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const rowNumber = row.rowNumber ?? i + 1;
    const name = (row.name || "").trim();
    const roleRaw = (row.role || defaultRole || "student").trim().toLowerCase();
    const result: RowResult = { rowNumber, name, role: roleRaw, status: "error" };
    results.push(result);

    if (!name) { result.reason = "Name is missing."; continue; }
    if (roleRaw !== "student" && roleRaw !== "teacher") {
      result.reason = `Role must be "student" or "teacher" (got "${row.role}").`;
      continue;
    }

    const email = (row.email || "").trim().toLowerCase();
    if (email) {
      if (!EMAIL_RE.test(email)) { result.reason = `"${row.email}" is not a valid email.`; continue; }
      if (emailsInBatch.has(email) || (await User.exists({ email }))) {
        result.status = "skipped";
        result.reason = "That email is already registered.";
        continue;
      }
    }

    let classId: any;
    if (roleRaw === "student") {
      const cls = classByName.get((row.class || "").trim().toLowerCase());
      if (!cls) {
        result.reason = row.class
          ? `Class "${row.class}" doesn't exist. Create it in Setup first.`
          : "Class is required for students.";
        continue;
      }
      classId = cls._id;
      result.className = cls.name;
    }

    let subjectIds: any[] | undefined;
    if (roleRaw === "teacher" && row.subjects && row.subjects.trim()) {
      const names = row.subjects.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
      const missing = names.filter((n) => !subjectByName.has(n.toLowerCase()));
      if (missing.length > 0) {
        result.reason = `Unknown subject(s): ${missing.join(", ")}. Create them in Setup first.`;
        continue;
      }
      subjectIds = names.map((n) => subjectByName.get(n.toLowerCase())!._id);
    }

    if (!allowDuplicates) {
      const dupFilter: Record<string, unknown> = {
        schoolId,
        role: roleRaw,
        name: new RegExp(`^${escapeRegex(name)}$`, "i")
      };
      if (classId) dupFilter.classId = classId;
      if (await User.exists(dupFilter)) {
        result.status = "skipped";
        result.reason = roleRaw === "student"
          ? "A student with this name is already in that class."
          : "A teacher with this name already exists.";
        continue;
      }
    }

    const username = await reserveUsername(usernameBase(name), usernamesInBatch);
    if (email) emailsInBatch.add(email);
    const plain = generatePassword();
    result.username = username;
    result.email = email || undefined;
    result.password = plain;
    toCreate.push({
      result,
      plain,
      doc: {
        schoolId,
        name,
        username,
        email: email || syntheticEmail(username),
        role: roleRaw,
        classId,
        subjectIds,
        mustChangePassword: true
      }
    });
  }

  // Hash in parallel; bcryptjs yields to the event loop so this doesn't block.
  const hashes = await Promise.all(toCreate.map((t) => bcrypt.hash(t.plain, 10)));
  const settled = await Promise.allSettled(
    toCreate.map((t, idx) => User.create({ ...t.doc, passwordHash: hashes[idx] }))
  );

  settled.forEach((outcome, idx) => {
    const { result } = toCreate[idx];
    if (outcome.status === "fulfilled") {
      result.status = "created";
    } else {
      result.status = "error";
      result.password = undefined;
      result.username = undefined;
      result.reason = outcome.reason?.code === 11000
        ? "Username or email was taken by another account at the same moment. Re-upload this row."
        : "Couldn't save this account.";
    }
  });

  const summary = {
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "error").length
  };

  await logActivity(req, {
    action: "users.bulk_import",
    summary: `Bulk import: ${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed`,
    entityType: "user",
    meta: summary
  });

  res.json({ summary, results });
}

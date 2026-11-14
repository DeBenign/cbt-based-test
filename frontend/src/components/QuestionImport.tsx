import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import Card from "./Card";
import Badge from "./Badge";
import PrimaryButton from "./PrimaryButton";
import { Subject, ClassRoom } from "../types";

const CHECK_BATCH = 500; // keep in step with MAX_CHECK_BATCH on the server (nothing is saved while checking)
const SAVE_BATCH = 50; // keep in step with MAX_IMPORT_BATCH on the server

interface ParsedRow {
  rowNumber: number;
  subject?: string;
  class?: string;
  topic?: string;
  type?: string;
  difficulty?: string;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  correct?: string;
  answer?: string;
  marks?: string;
}

interface ResultRow {
  rowNumber: number;
  question: string;
  subject?: string;
  className?: string;
  subjectId?: string;
  classId?: string;
  status: "ready" | "created" | "skipped" | "error";
  reason?: string;
}

type Phase = "idle" | "checking" | "checked" | "importing" | "done";

const COLUMNS: (keyof Omit<ParsedRow, "rowNumber">)[] = [
  "subject", "class", "topic", "type", "difficulty", "question",
  "optionA", "optionB", "optionC", "optionD", "optionE", "correct", "answer", "marks"
];

// Spreadsheet headers vary; map the common spellings onto our fields.
const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  subject: "subject", "subject name": "subject",
  class: "class", classroom: "class", "class name": "class",
  topic: "topic", "topic name": "topic",
  type: "type", "question type": "type",
  difficulty: "difficulty", level: "difficulty",
  question: "question", "question text": "question", questions: "question",
  "option a": "optionA", "option_a": "optionA", a: "optionA", optiona: "optionA",
  "option b": "optionB", "option_b": "optionB", b: "optionB", optionb: "optionB",
  "option c": "optionC", "option_c": "optionC", c: "optionC", optionc: "optionC",
  "option d": "optionD", "option_d": "optionD", d: "optionD", optiond: "optionD",
  "option e": "optionE", "option_e": "optionE", e: "optionE", optione: "optionE",
  correct: "correct", "correct answer": "correct", "correct option": "correct", answer_key: "correct", key: "correct",
  answer: "answer", "model answer": "answer", "theory answer": "answer", "marking guide": "answer",
  marks: "marks", mark: "marks", score: "marks"
};

function normalise(records: Record<string, unknown>[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  records.forEach((rec, i) => {
    const row: any = { rowNumber: i + 2 }; // +2: the header is row 1 in the spreadsheet
    for (const [key, value] of Object.entries(rec)) {
      const field = HEADER_ALIASES[key.trim().toLowerCase()];
      if (field && value !== null && value !== undefined && String(value).trim() !== "") row[field] = String(value).trim();
    }
    if (Object.keys(row).length > 1) rows.push(row);
  });
  return rows;
}

// The spreadsheet readers are only needed when someone actually picks a file,
// so they load then instead of slowing down every page.
async function parseFile(file: File): Promise<ParsedRow[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return normalise(parsed.data);
  }
  if (lower.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file); // first worksheet
    if (sheet.length < 2) return [];
    const headers = sheet[0].map((h: unknown) => String(h ?? ""));
    const records = sheet.slice(1).map((cells: unknown[]) => Object.fromEntries(headers.map((h: string, idx: number) => [h, cells[idx]])));
    return normalise(records);
  }
  throw new Error("Use a .csv or .xlsx file. (In Excel: File → Save As → CSV, or keep it as .xlsx.)");
}

function downloadCsv(filename: string, rows: (string | undefined)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const short = (t: string | undefined, n = 70) => (!t ? "—" : t.length > n ? t.slice(0, n) + "…" : t);

interface Props {
  subjects: Subject[]; // the subjects this person may import into
  classes: ClassRoom[]; // the classes this person may import into
  subjectId: string; // what the Question Bank is currently showing: the default target
  classId: string;
  onDone: () => void; // refresh the bank
  onShowInBank: (subjectId: string, classId: string) => void;
}

export default function QuestionImport({ subjects, classes, subjectId, classId, onDone, onShowInBank }: Props) {
  const [open, setOpen] = useState(false);
  const [targetSubject, setTargetSubject] = useState(subjectId);
  const [targetClass, setTargetClass] = useState(classId);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Follow the bank's selection until a file is loaded.
  useEffect(() => {
    if (rows.length === 0) { setTargetSubject(subjectId); setTargetClass(classId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, classId]);

  const targetSubjectObj = subjects.find((s) => s._id === targetSubject);
  const classChoices = classes.filter((c) => !targetSubjectObj || targetSubjectObj.classIds.includes(c._id));
  const busy = phase === "checking" || phase === "importing";

  function reset() {
    setRows([]);
    setFileName("");
    setResults([]);
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadTemplate() {
    const subject = targetSubjectObj || subjects[0];
    const cls = classes.find((c) => c._id === targetClass) || classes.find((c) => subject?.classIds.includes(c._id)) || classes[0];
    const s = subject?.name || "Mathematics";
    const c = cls?.name || "Primary 5";
    downloadCsv("questions-template.csv", [
      ["subject", "class", "topic", "type", "difficulty", "question", "option A", "option B", "option C", "option D", "option E", "correct", "answer", "marks"],
      [s, c, "Fractions", "mcq", "easy", "What is 1/2 + 1/4?", "3/4", "2/6", "1/8", "1", "", "A", "", "1"],
      [s, c, "Fractions", "mcq", "medium", "Which fraction is the largest?", "1/2", "3/4", "2/3", "1/3", "", "3/4", "", "1"],
      [s, c, "Fractions", "theory", "medium", "Explain what a fraction is, with one example.", "", "", "", "", "", "", "A part of a whole, e.g. 1/2 of an orange.", "5"]
    ]);
  }

  // Vets every row (rules, permissions, duplicates against the bank and the file). Nothing is saved.
  async function runCheck(list: ParsedRow[], subj = targetSubject, cls = targetClass) {
    setError(null);
    setPhase("checking");
    setResults([]);
    setProgress(0);
    const collected: ResultRow[] = [];
    try {
      for (let i = 0; i < list.length; i += CHECK_BATCH) {
        const res = await api.post("/questions/import", {
          rows: list.slice(i, i + CHECK_BATCH),
          dryRun: true,
          targetSubjectId: subj || undefined,
          targetClassId: cls || undefined
        });
        collected.push(...res.data.results);
        setProgress(Math.min(list.length, i + CHECK_BATCH));
      }
      setResults(collected);
      setPhase("checked");
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't check the file. Check your connection and try again.");
      setPhase("idle");
    }
  }

  async function handleFile(file: File | undefined) {
    reset();
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setError("No rows found. Check the file has a header row (subject, class, question …) and at least one question.");
        return;
      }
      setFileName(file.name);
      setRows(parsed);
      await runCheck(parsed);
    } catch (err: any) {
      setError(err?.message || "Couldn't read that file.");
    }
  }

  function changeTarget(subj: string, cls: string) {
    setTargetSubject(subj);
    setTargetClass(cls);
    if (rows.length > 0 && !busy) runCheck(rows, subj, cls);
  }

  const ready = results.filter((r) => r.status === "ready");
  const duplicates = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "error");
  const created = results.filter((r) => r.status === "created");
  const problems = results.filter((r) => r.status === "skipped" || r.status === "error");

  // Saves only the rows that passed the check.
  async function runImport() {
    const readyNumbers = new Set(ready.map((r) => r.rowNumber));
    const toSave = rows.filter((r) => readyNumbers.has(r.rowNumber));
    const previous = results.filter((r) => r.status !== "ready");
    const saved: ResultRow[] = [];
    setError(null);
    setPhase("importing");
    setProgress(0);
    try {
      for (let i = 0; i < toSave.length; i += SAVE_BATCH) {
        const res = await api.post("/questions/import", {
          rows: toSave.slice(i, i + SAVE_BATCH),
          targetSubjectId: targetSubject || undefined,
          targetClassId: targetClass || undefined
        });
        saved.push(...res.data.results);
        setResults([...previous, ...saved]);
        setProgress(Math.min(toSave.length, i + SAVE_BATCH));
      }
    } catch (err: any) {
      // Batches already saved stay saved; checking again shows them as duplicates.
      setError(
        `${err.response?.data?.error || "The connection dropped."} Stopped after ${saved.length} of ${toSave.length} questions. ` +
        `Those are saved. Choose the file again and the checker will skip them as duplicates.`
      );
    }
    setResults([...previous, ...saved]);
    setPhase("done");
    onDone();

    // Take the teacher to where the questions landed, so they can see them straight away.
    const landed = saved.filter((r) => r.status === "created" && r.subjectId && r.classId);
    if (landed.length > 0 && !landed.some((r) => r.subjectId === subjectId && r.classId === classId)) {
      onShowInBank(landed[0].subjectId!, landed[0].classId!);
    }
  }

  // Where the saved questions went.
  const destinations = (() => {
    const map = new Map<string, { subjectId: string; classId: string; label: string; count: number }>();
    for (const r of created) {
      if (!r.subjectId || !r.classId) continue;
      const k = `${r.subjectId}:${r.classId}`;
      const cur = map.get(k) || { subjectId: r.subjectId, classId: r.classId, label: `${r.subject} · ${r.className}`, count: 0 };
      cur.count++;
      map.set(k, cur);
    }
    return [...map.values()];
  })();

  // Same columns as the template plus a "problem" column, so the teacher can fix and re-upload it.
  function downloadProblems() {
    const byRow = new Map(rows.map((r) => [r.rowNumber, r]));
    downloadCsv("questions-needing-attention.csv", [
      [...COLUMNS, "problem"],
      ...problems.map((p) => [...COLUMNS.map((c) => (byRow.get(p.rowNumber) as any)?.[c] ?? ""), p.reason])
    ]);
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Import questions from a spreadsheet</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>
            Upload a CSV or Excel file. Every question is checked first, and nothing is saved until you confirm.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Import"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Importing into: subject</label>
              <select
                value={targetSubject}
                disabled={busy}
                onChange={(e) => {
                  const s = subjects.find((x) => x._id === e.target.value);
                  const nextClass = s && !s.classIds.includes(targetClass) ? (classes.find((c) => s.classIds.includes(c._id))?._id || "") : targetClass;
                  changeTarget(e.target.value, nextClass);
                }}
                style={{ width: "100%" }}
              >
                <option value="">As written in each row</option>
                {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Class</label>
              <select value={targetClass} disabled={busy} onChange={(e) => changeTarget(targetSubject, e.target.value)} style={{ width: "100%" }}>
                <option value="">As written in each row</option>
                {classChoices.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Rows that name a different subject or class than the one chosen here are flagged, so questions never land in the wrong class.
            Pick "As written in each row" for a file that covers several classes. You can only import into classes assigned to you.
          </p>

          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={downloadTemplate}>Download template</button>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Columns: <b>question</b> (required), <b>subject</b> and <b>class</b> (blank = the choice above). For MCQs add <b>option A</b> to <b>option E</b> (at least two)
            and <b>correct</b> (A–E or the option text). For theory, add an optional <b>answer</b>. Optional: <b>topic</b>, <b>type</b> (mcq/theory),
            <b> difficulty</b> (easy/medium/hard), <b>marks</b>.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.txt"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
            style={{ width: "100%", marginBottom: 10 }}
          />

          {busy && rows.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 8, background: "var(--bg-neutral)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${(progress / (phase === "importing" ? Math.max(1, ready.length) : rows.length)) * 100}%`, background: "var(--accent)", transition: "width 0.2s" }} />
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {phase === "checking" ? `Checking ${rows.length} question(s)…` : `Saving… ${progress} of ${ready.length}`}
              </p>
            </div>
          )}

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

          {phase === "checked" && (
            <div>
              <p style={{ marginBottom: 8 }}>Checked <b>{rows.length}</b> question(s) in {fileName}. Nothing is saved yet.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Badge tone="success">{ready.length} ready to import</Badge>
                <Badge tone="warning">{duplicates.length} duplicate(s) will be skipped</Badge>
                <Badge tone="danger">{failed.length} need fixing</Badge>
              </div>

              {problems.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontWeight: 500, marginBottom: 0 }}>Won't be imported</p>
                    <button type="button" onClick={downloadProblems} style={{ padding: "3px 10px", fontSize: 12 }}>Download to fix</button>
                  </div>
                  <div style={{ maxHeight: 260, overflow: "auto" }}>
                    <table>
                      <thead><tr><th>Row</th><th>Question</th><th></th><th>Why</th></tr></thead>
                      <tbody>
                        {problems.map((r) => (
                          <tr key={`${r.rowNumber}-${r.question}`}>
                            <td>{r.rowNumber}</td>
                            <td>{short(r.question)}</td>
                            <td><Badge tone={r.status === "skipped" ? "warning" : "danger"}>{r.status === "skipped" ? "Duplicate" : "Fix"}</Badge></td>
                            <td>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {ready.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 500, marginBottom: 6 }}>Ready to import{ready.length > 5 ? " (first 5)" : ""}</p>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead><tr><th>Row</th><th>Subject</th><th>Class</th><th>Question</th></tr></thead>
                      <tbody>
                        {ready.slice(0, 5).map((r) => (
                          <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.subject}</td><td>{r.className}</td><td>{short(r.question)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryButton type="button" disabled={ready.length === 0} onClick={runImport}>
                  Import {ready.length} question(s)
                </PrimaryButton>
                <button type="button" onClick={reset}>Choose a different file</button>
              </div>
              {ready.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Nothing to import. Fix the rows above and choose the file again.</p>}
            </div>
          )}

          {phase === "done" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <Badge tone="success">{created.length} imported</Badge>
                {duplicates.length > 0 && <Badge tone="warning">{duplicates.length} duplicate(s) skipped</Badge>}
                {failed.length > 0 && <Badge tone="danger">{failed.length} not imported</Badge>}
              </div>

              {destinations.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 500, marginBottom: 6 }}>Saved to the question bank</p>
                  {destinations.map((d) => (
                    <div key={`${d.subjectId}:${d.classId}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{d.label}: <b>{d.count}</b> question(s)</span>
                      <button type="button" onClick={() => onShowInBank(d.subjectId, d.classId)} style={{ padding: "3px 10px", fontSize: 12 }}>View in bank</button>
                    </div>
                  ))}
                </div>
              )}

              {problems.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontWeight: 500, marginBottom: 0 }}>Not imported</p>
                    <button type="button" onClick={downloadProblems} style={{ padding: "3px 10px", fontSize: 12 }}>Download to fix</button>
                  </div>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    <table>
                      <thead><tr><th>Row</th><th>Question</th><th>Why</th></tr></thead>
                      <tbody>
                        {problems.map((r) => (
                          <tr key={`${r.rowNumber}-${r.question}`}><td>{r.rowNumber}</td><td>{short(r.question)}</td><td>{r.reason}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button type="button" onClick={reset}>Import another file</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

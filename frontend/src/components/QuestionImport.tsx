import { useRef, useState } from "react";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import api from "../services/api";
import Card from "./Card";
import Badge from "./Badge";
import PrimaryButton from "./PrimaryButton";
import { Subject, ClassRoom } from "../types";

const BATCH_SIZE = 50; // keep in step with MAX_IMPORT_BATCH on the server

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
  status: "created" | "skipped" | "error";
  reason?: string;
}

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
    const row: any = { rowNumber: i + 2 }; // +2: header is row 1 in the spreadsheet
    for (const [key, value] of Object.entries(rec)) {
      const field = HEADER_ALIASES[key.trim().toLowerCase()];
      if (field && value !== null && value !== undefined && String(value).trim() !== "") row[field] = String(value).trim();
    }
    if (Object.keys(row).length > 1) rows.push(row);
  });
  return rows;
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return normalise(parsed.data);
  }
  if (lower.endsWith(".xlsx")) {
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

export default function QuestionImport({ subjects, classes, onDone }: { subjects: Subject[]; classes: ClassRoom[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [finished, setFinished] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setResults([]);
    setFinished(false);
    setProgress(0);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadTemplate() {
    const subject = subjects[0];
    const cls = classes.find((c) => subject?.classIds.includes(c._id)) || classes[0];
    const s = subject?.name || "Mathematics";
    const c = cls?.name || "Primary 5";
    downloadCsv("questions-template.csv", [
      ["subject", "class", "topic", "type", "difficulty", "question", "option A", "option B", "option C", "option D", "option E", "correct", "answer", "marks"],
      [s, c, "Fractions", "mcq", "easy", "What is 1/2 + 1/4?", "3/4", "2/6", "1/8", "1", "", "A", "", "1"],
      [s, c, "Fractions", "mcq", "medium", "Which fraction is the largest?", "1/2", "3/4", "2/3", "1/3", "", "3/4", "", "1"],
      [s, c, "Fractions", "theory", "medium", "Explain what a fraction is, with one example.", "", "", "", "", "", "", "A part of a whole, e.g. 1/2 of an orange.", "5"]
    ]);
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
    } catch (err: any) {
      setError(err?.message || "Couldn't read that file.");
    }
  }

  async function runImport() {
    setError(null);
    setRunning(true);
    setFinished(false);
    setResults([]);
    setProgress(0);
    const collected: ResultRow[] = [];
    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const res = await api.post("/questions/import", { rows: batch, allowDuplicates });
        collected.push(...res.data.results);
        setResults([...collected]);
        setProgress(Math.min(rows.length, i + BATCH_SIZE));
      }
      setFinished(true);
    } catch (err: any) {
      // Batches already saved stay saved; re-uploading skips them as duplicates.
      setError(
        `${err.response?.data?.error || "The connection dropped."} Stopped after ${collected.length} of ${rows.length} rows. ` +
        `Questions already imported are safe — upload the file again and they'll be skipped as duplicates.`
      );
      setFinished(true);
    } finally {
      setRunning(false);
      onDone();
    }
  }

  const created = results.filter((r) => r.status === "created");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "error");
  const problems = results.filter((r) => r.status !== "created");

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
            Upload a CSV or Excel file with many questions at once, across subjects and classes.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Import"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={downloadTemplate}>Download template</button>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Required: <b>subject</b>, <b>class</b> (must match Setup exactly) and <b>question</b>. For MCQs add <b>option A</b> to <b>option E</b> (at least two)
            and <b>correct</b> (A–E or the option text). For theory, add an optional <b>answer</b>. Optional: <b>topic</b>, <b>type</b> (mcq/theory),
            <b> difficulty</b> (easy/medium/hard), <b>marks</b>. You can only import into subjects you teach.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.txt"
            disabled={running}
            onChange={(e) => handleFile(e.target.files?.[0])}
            style={{ width: "100%", marginBottom: 10 }}
          />

          {rows.length > 0 && !running && !finished && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 6 }}><b>{rows.length}</b> question(s) found in {fileName}. Preview:</p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr><th>#</th><th>Subject</th><th>Class</th><th>Question</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 5).map((r) => (
                      <tr key={r.rowNumber}>
                        <td>{r.rowNumber}</td><td>{r.subject || "—"}</td><td>{r.class || "—"}</td>
                        <td>{r.question ? (r.question.length > 70 ? r.question.slice(0, 70) + "…" : r.question) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", fontSize: 13 }}>
                <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} style={{ width: "auto" }} />
                Import questions even if they look like ones already in the bank (otherwise they're skipped)
              </label>
              <PrimaryButton type="button" onClick={runImport}>Import {rows.length} question(s)</PrimaryButton>
            </div>
          )}

          {(running || finished) && rows.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 8, background: "var(--bg-neutral)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${(progress / rows.length) * 100}%`, background: "var(--accent)", transition: "width 0.2s" }} />
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {running ? `Importing… ${progress} of ${rows.length}` : `Processed ${results.length} of ${rows.length} rows.`}
              </p>
            </div>
          )}

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

          {results.length > 0 && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <Badge tone="success">{created.length} imported</Badge>
                <Badge tone="warning">{skipped.length} skipped</Badge>
                <Badge tone="danger">{failed.length} need fixing</Badge>
              </div>

              {problems.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontWeight: 500, marginBottom: 0 }}>Rows that weren't imported</p>
                    <button type="button" onClick={downloadProblems} style={{ padding: "3px 10px", fontSize: 12 }}>Download to fix</button>
                  </div>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    <table>
                      <thead><tr><th>Row</th><th>Question</th><th>Why</th></tr></thead>
                      <tbody>
                        {problems.map((r) => (
                          <tr key={`${r.rowNumber}-${r.question}`}>
                            <td>{r.rowNumber}</td><td>{r.question || "—"}</td><td>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {finished && <button type="button" onClick={reset}>Import another file</button>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
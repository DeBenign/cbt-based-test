import { useRef, useState } from "react";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import api from "../services/api";
import Card from "./Card";
import Badge from "./Badge";
import PrimaryButton from "./PrimaryButton";
import { ClassRoom } from "../types";

const BATCH_SIZE = 40; // keep in step with MAX_BULK_BATCH on the server

interface ParsedRow {
  rowNumber: number;
  name: string;
  role?: string;
  class?: string;
  subjects?: string;
  email?: string;
}

interface ResultRow {
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

// Spreadsheet headers vary a lot; map the common spellings onto our fields.
const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  name: "name", "full name": "name", fullname: "name", "student name": "name", "teacher name": "name", student: "name", teacher: "name",
  role: "role", type: "role",
  class: "class", classroom: "class", "class name": "class", form: "class", grade: "class",
  subjects: "subjects", subject: "subjects",
  email: "email", "e-mail": "email", "email address": "email"
};

function normalise(records: Record<string, unknown>[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  records.forEach((rec, i) => {
    const row: any = { rowNumber: i + 2 }; // +2: header is row 1 in the spreadsheet
    for (const [key, value] of Object.entries(rec)) {
      const field = HEADER_ALIASES[key.trim().toLowerCase()];
      if (field && value !== null && value !== undefined) row[field] = String(value).trim();
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
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUpload({ classes, onDone }: { classes: ClassRoom[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [defaultRole, setDefaultRole] = useState<"student" | "teacher">("student");
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
    const sampleClass = classes[0]?.name || "JSS1A";
    if (defaultRole === "student") {
      downloadCsv("students-template.csv", [
        ["name", "class"],
        ["Adaeze Okafor", sampleClass],
        ["Tunde Bakare", sampleClass]
      ]);
    } else {
      downloadCsv("teachers-template.csv", [
        ["name", "subjects", "email"],
        ["Mrs Ngozi Eze", "Basic Science; Mathematics", "ngozi@school.com"],
        ["Mr Bola Ade", "English Language", ""]
      ]);
    }
  }

  async function handleFile(file: File | undefined) {
    reset();
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setError("No rows found. Check the file has a header row (e.g. name, class) and at least one person.");
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
        const res = await api.post("/users/bulk", { rows: batch, defaultRole, allowDuplicates });
        collected.push(...res.data.results);
        setResults([...collected]);
        setProgress(Math.min(rows.length, i + BATCH_SIZE));
      }
      setFinished(true);
    } catch (err: any) {
      // Batches already imported stay imported; say exactly where it stopped so
      // the admin can re-upload the rest without creating duplicates.
      setError(
        `${err.response?.data?.error || "The connection dropped."} Stopped after ${collected.length} of ${rows.length} rows. ` +
        `Rows already imported are safe — upload the file again and they'll be skipped as duplicates.`
      );
      setFinished(true);
    } finally {
      setRunning(false);
      onDone();
    }
  }

  const created = results.filter((r) => r.status === "created");
  const problems = results.filter((r) => r.status !== "created");

  function downloadCredentials() {
    downloadCsv("new-account-logins.csv", [
      ["Name", "Role", "Class", "Username", "Email", "Temporary password"],
      ...created.map((r) => [r.name, r.role, r.className, r.username, r.email, r.password])
    ]);
  }

  function downloadProblems() {
    downloadCsv("rows-needing-attention.csv", [
      ["Row", "Name", "Status", "Reason"],
      ...problems.map((r) => [String(r.rowNumber), r.name, r.status, r.reason])
    ]);
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Upload a list of students or teachers</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>
            One spreadsheet for a whole class or school. Usernames and temporary passwords are generated for you.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Bulk upload"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <label>This file contains</label>
              <select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as "student" | "teacher")} disabled={running}>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
              </select>
            </div>
            <button type="button" onClick={downloadTemplate}>Download template</button>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {defaultRole === "student"
              ? <>Columns: <b>name</b>, <b>class</b> (must match a class in Setup exactly, e.g. JSS1A). Optional: email.</>
              : <>Columns: <b>name</b>, <b>subjects</b> (separate several with ; — must match Setup), optional <b>email</b>. A row can also have a <b>role</b> column to mix students and teachers.</>}
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
              <p style={{ marginBottom: 6 }}><b>{rows.length}</b> row(s) found in {fileName}. Preview:</p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Class / subjects</th><th>Email</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 5).map((r) => (
                      <tr key={r.rowNumber}>
                        <td>{r.rowNumber}</td><td>{r.name || "—"}</td><td>{r.class || r.subjects || "—"}</td><td>{r.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", fontSize: 13 }}>
                <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} style={{ width: "auto" }} />
                Allow people with the same name as an existing account (otherwise they're skipped)
              </label>
              <PrimaryButton type="button" onClick={runImport}>Create {rows.length} account(s)</PrimaryButton>
            </div>
          )}

          {(running || finished) && rows.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 8, background: "var(--bg-neutral)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${(progress / rows.length) * 100}%`, background: "var(--accent)", transition: "width 0.2s" }} />
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {running ? `Creating accounts… ${progress} of ${rows.length}` : `Processed ${results.length} of ${rows.length} rows.`}
              </p>
            </div>
          )}

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

          {results.length > 0 && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <Badge tone="success">{created.length} created</Badge>
                <Badge tone="warning">{results.filter((r) => r.status === "skipped").length} skipped</Badge>
                <Badge tone="danger">{results.filter((r) => r.status === "error").length} need fixing</Badge>
              </div>

              {created.length > 0 && (
                <Card style={{ background: "var(--bg-warning)", borderColor: "transparent", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, marginBottom: 8 }}>
                    <b>Download the login sheet now.</b> Temporary passwords are only shown here, once — they can't be looked up later
                    (you can still reset any password from the list below). Everyone is asked to choose their own password at first sign-in.
                  </p>
                  <PrimaryButton type="button" onClick={downloadCredentials}>Download logins (CSV)</PrimaryButton>
                </Card>
              )}

              {problems.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontWeight: 500, marginBottom: 0 }}>Rows that weren't created</p>
                    <button type="button" onClick={downloadProblems} style={{ padding: "3px 10px", fontSize: 12 }}>Download list</button>
                  </div>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    <table>
                      <thead><tr><th>Row</th><th>Name</th><th>Why</th></tr></thead>
                      <tbody>
                        {problems.map((r) => (
                          <tr key={`${r.rowNumber}-${r.name}`}>
                            <td>{r.rowNumber}</td><td>{r.name || "—"}</td><td>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button type="button" onClick={reset}>Upload another file</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

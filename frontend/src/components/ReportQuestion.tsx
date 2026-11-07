import { useState } from "react";
import api from "../services/api";

const REASONS: [string, string][] = [
  ["wrong_answer", "The marked answer is wrong"],
  ["unclear", "Unclear or badly worded"],
  ["off_curriculum", "Not from our curriculum"],
  ["wrong_level", "Wrong level for this class"],
  ["duplicate", "Repeats another question"],
  ["other", "Something else"]
];

// "Report" button for an AI question. The report goes to the platform owner, who uses the
// pattern of reports to improve the prompts and judge the model. It does not change the question.
export default function ReportQuestion({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("wrong_answer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/questions/${questionId}/report`, { reason, note });
      setDone(true);
      setOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Reported — thank you</span>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ padding: "4px 14px", fontSize: 12 }}>Report</button>;

  return (
    <div style={{ width: "100%", marginTop: 8, padding: 10, border: "0.5px solid var(--border)", borderRadius: "var(--radius)" }}>
      <label>What is wrong with this question?</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", marginBottom: 8 }}>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
        placeholder={reason === "other" ? "Say what is wrong (required)" : "Optional note"} style={{ width: "100%", marginBottom: 8 }} />
      {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={submit} disabled={busy} style={{ padding: "4px 14px", fontSize: 12 }}>{busy ? "Sending…" : "Send report"}</button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: "4px 14px", fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

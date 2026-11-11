import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import InsightsNav from "../components/InsightsNav";
import ReportCardSheet, { Card, CardHead, PRINT_CSS } from "../components/ReportCardSheet";

interface Data extends CardHead { cards: Card[]; examCount: number; pending: { subjectRemarks: number; overall: number } }

// Admin: preview and print report cards for a whole class (one card per page), or save them as a PDF.
export default function ReportCards() {
  const rolePath = useRolePath();
  const [classes, setClasses] = useState<{ classId: string; className: string }[] | null>(null);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [termLabel, setTermLabel] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/analytics/options").then((r) => {
      const unique = [...new Map((r.data as any[]).map((o) => [o.classId, { classId: o.classId, className: o.className }])).values()];
      setClasses(unique);
      if (unique[0]) setClassId(unique[0].classId);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    setData(null); setError(null);
    api.get("/reportcards/class", { params: { classId, from: from || undefined, to: to || undefined } })
      .then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load the report cards."));
  }, [classId, from, to]);

  if (!classes) return <PageShell><Spinner /></PageShell>;

  return (
    <div className="rc-wrap" style={{ maxWidth: 820, margin: "48px auto", padding: "0 20px" }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <h1>Report cards</h1>
        <InsightsNav />
        <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
          One card per student, with exam averages and the remarks you have released. Press Print, then choose "Save as PDF" to keep a copy. Remarks that are not released print as a dash.
        </p>
        {classes.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>Report cards appear once a class has finished exams.</p> : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 12 }}>
            <div><label>Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%" }}>{classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}</select></div>
            <div><label>Term label (printed on the card)</label><input value={termLabel} onChange={(e) => setTermLabel(e.target.value)} placeholder="e.g. 2026/27 First Term" style={{ width: "100%" }} /></div>
            <div><label>Exams from (optional)</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%" }} /></div>
            <div><label>Exams to (optional)</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%" }} /></div>
          </div>
        )}
        {error && <p style={{ color: "var(--text-danger)" }}>{error}</p>}
        {classId && !data && !error && <Spinner />}
        {data && data.cards.length > 0 && (
          <>
            {(data.pending.subjectRemarks > 0 || data.pending.overall > 0) && (
              <p style={{ padding: 10, borderRadius: "var(--radius)", background: "var(--bg-warning)", color: "var(--text-warning)", fontSize: 13, marginBottom: 12 }}>
                {data.pending.overall} overall and {data.pending.subjectRemarks} subject remark(s) are not released yet and will print blank.{" "}
                <Link to={rolePath("/remarks")}>Write overall remarks</Link>. Subject remarks are released by each subject teacher.
              </p>
            )}
            <button type="button" onClick={() => window.print()} style={{ marginBottom: 16, padding: "8px 16px", fontWeight: 600 }}>Print all {data.cards.length} cards / save as PDF</button>
          </>
        )}
        {data && data.cards.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No finished exams for this class{from || to ? " in that period" : ""}, so there is nothing to print yet.</p>}
      </div>
      {data?.cards.map((c) => <ReportCardSheet key={c.student.id} head={data} card={c} termLabel={termLabel} />)}
    </div>
  );
}

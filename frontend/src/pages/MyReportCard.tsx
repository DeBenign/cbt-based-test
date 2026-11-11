import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import ReportCardSheet, { Card, CardHead, PRINT_CSS } from "../components/ReportCardSheet";

// Student: my own report card, to print or save as PDF.
export default function MyReportCard() {
  const rolePath = useRolePath();
  const [data, setData] = useState<(CardHead & { card: Card | null; examCount: number }) | null>(null);
  const [termLabel, setTermLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get("/reportcards/me").then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load your report card.")); }, []);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!data) return <PageShell><Spinner /></PageShell>;

  return (
    <div className="rc-wrap" style={{ maxWidth: 820, margin: "48px auto", padding: "0 20px" }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <h1>My report card</h1>
        <p style={{ color: "var(--text-secondary)" }}>Remarks appear here once your teachers have released them. <Link to={rolePath("/progress")}>Back to my progress</Link></p>
        {data.card ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}><label>Term label (optional)</label><input value={termLabel} onChange={(e) => setTermLabel(e.target.value)} placeholder="e.g. 2026/27 First Term" style={{ width: "100%" }} /></div>
            <button type="button" onClick={() => window.print()} style={{ padding: "8px 16px", fontWeight: 600 }}>Print / save as PDF</button>
          </div>
        ) : <p style={{ color: "var(--text-secondary)" }}>No results yet. Your report card appears after your class's first exam.</p>}
      </div>
      {data.card && <ReportCardSheet head={data} card={data.card} termLabel={termLabel} />}
    </div>
  );
}

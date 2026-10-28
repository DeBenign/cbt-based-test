import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import PrimaryButton from "../components/PrimaryButton";

interface ReceiptData {
  receiptNo: string;
  issuedAt: string;
  issuer: { name: string; contact: string };
  school: { name: string; address: string };
  amount: number;
  method: "nomba" | "manual";
  reference: string;
  terms: number | null;
  termLabel: string | null;
  accessUntil: string | null;
  status: "applied" | "voided";
  voidedAt: string | null;
  voidReason: string | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function Receipt() {
  const { user } = useAuth();
  const { paymentId } = useParams<{ paymentId: string }>();
  const [search] = useSearchParams();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Admins fetch their own school's receipt; the owner names the school in the link.
    const url = user?.role === "superadmin"
      ? `/schools/${search.get("school")}/payments/${paymentId}/receipt`
      : `/billing/payments/${paymentId}/receipt`;
    api.get(url)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load the receipt."));
  }, [paymentId, user?.role, search]);

  const cell = { padding: "8px 0", borderBottom: "0.5px solid var(--border)" } as const;

  return (
    <PageShell maxWidth={560}>
      <style>{`@media print { body * { visibility: hidden; } .receipt-print, .receipt-print * { visibility: visible; } .receipt-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; } }`}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Link to={user?.role === "superadmin" ? "/superadmin/schools" : "/admin/billing"}>← Back</Link>
        {data && <PrimaryButton type="button" onClick={() => window.print()}>Print / save as PDF</PrimaryButton>}
      </div>
      {error && <p style={{ color: "var(--text-danger)" }}>{error}</p>}
      {!data && !error && <p style={{ display: "flex", alignItems: "center" }}><Spinner />Loading…</p>}
      {data && (
        <div className="receipt-print" style={{ background: "#fff", color: "#111", border: "1px solid var(--border)", borderRadius: 8, padding: "28px 32px", position: "relative" }}>
          <h2 style={{ marginBottom: 2 }}>{data.issuer.name}</h2>
          {data.issuer.contact && <p style={{ fontSize: 12, color: "#555", marginTop: 0 }}>{data.issuer.contact}</p>}
          <h3 style={{ marginTop: 18, marginBottom: 4 }}>Payment receipt</h3>
          <p style={{ fontSize: 13, color: "#555", marginTop: 0 }}>No. {data.receiptNo} · {fmtDate(data.issuedAt)}</p>

          {data.status === "voided" && (
            <p style={{ border: "2px solid #b00020", color: "#b00020", fontWeight: 700, padding: "6px 10px", display: "inline-block" }}>
              CANCELLED{data.voidedAt ? ` on ${fmtDate(data.voidedAt)}` : ""} — not valid as proof of payment
            </p>
          )}

          <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse", marginTop: 8 }}>
            <tbody>
              <tr><td style={cell}>Received from</td><td style={{ ...cell, textAlign: "right" }}><b>{data.school.name}</b>{data.school.address ? <><br />{data.school.address}</> : null}</td></tr>
              <tr><td style={cell}>Amount</td><td style={{ ...cell, textAlign: "right" }}><b>₦{data.amount.toLocaleString()}</b></td></tr>
              <tr><td style={cell}>For</td><td style={{ ...cell, textAlign: "right" }}>{[data.termLabel, data.terms ? `${data.terms} term${data.terms === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Subscription"}</td></tr>
              <tr><td style={cell}>Method</td><td style={{ ...cell, textAlign: "right" }}>{data.method === "nomba" ? "Online (Nomba)" : "Cash / bank transfer"}</td></tr>
              <tr><td style={cell}>Reference</td><td style={{ ...cell, textAlign: "right" }}>{data.reference}</td></tr>
              {data.accessUntil && <tr><td style={cell}>Access paid until</td><td style={{ ...cell, textAlign: "right" }}>{fmtDate(data.accessUntil)}</td></tr>}
              {data.voidReason && <tr><td style={cell}>Cancellation reason</td><td style={{ ...cell, textAlign: "right" }}>{data.voidReason}</td></tr>}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#777", marginTop: 18, marginBottom: 0 }}>Thank you. Keep this receipt for your records.</p>
        </div>
      )}
    </PageShell>
  );
}

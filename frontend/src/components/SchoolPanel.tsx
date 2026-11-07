import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Badge from "./Badge";
import DaysLeftBadge from "./DaysLeftBadge";

export interface SchoolRow {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  trialEndsAt: string;
  subscriptionStatus: string;
  subscriptionPaidUntil?: string;
  accessEndsAt: string;
  accessDaysLeft: number;
  studentCount: number;
  pricePerStudent: number;
  hasCustomPrice: boolean;
  termFee: number;
  termDays: number;
  maxTerms: number;
  adminCount: number;
  admins: { name: string; email: string }[];
  aiLimit: number;
  hasCustomAiLimit: boolean;
  aiUsedThisMonth: number;
  aiRequestsThisMonth: number;
  aiCostUsdThisMonth: number;
  aiModel: string;
}

interface PaymentItem {
  id: string;
  status: "applied" | "voided";
  receiptNo: string | null;
  amount: number;
  reference: string;
  terms: number | null;
  termLabel: string | null;
  confirmedAt: string;
  voidReason: string | null;
  canVoid: boolean;
}

type EmailResult = { sent: number; failed: number; skipped?: string; error?: string } | undefined;

function emailNote(r: EmailResult, who: string): string {
  if (!r) return "";
  if (r.skipped === "mail-not-configured") return "Receipt email NOT sent: mail isn't set up on the server (needs MAIL_FROM plus SMTP_* or RESEND_API_KEY).";
  if (r.skipped === "no-admin-email") return "Receipt email NOT sent: this school's admin has no real email address.";
  if (r.sent > 0 && r.failed === 0) return `Receipt emailed to ${who}.`;
  if (r.sent > 0) return `Receipt emailed to ${r.sent}, but ${r.failed} failed${r.error ? `: ${r.error}` : ""}.`;
  return `Receipt email could not be sent${r.error ? `: ${r.error}` : ""}. Check the mail settings, then press "Email receipt" on the payment to try again.`;
}

const DAY = 24 * 60 * 60 * 1000;
const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const label: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const section: React.CSSProperties = { marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--border)" };
const heading: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" };

// Everything the owner does for ONE school: see where its access stands, record a payment, manage receipts,
// and (tucked away) change its price and AI allowance.
export default function SchoolPanel({ school: s, onChanged }: { school: SchoolRow; onChanged: () => Promise<void> }) {
  const [payments, setPayments] = useState<PaymentItem[] | null>(null);
  const [terms, setTerms] = useState(1);
  const [amount, setAmount] = useState<string | null>(null); // null = follow the fee due
  const [reference, setReference] = useState("");
  const [termLabel, setTermLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [priceDraft, setPriceDraft] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  async function loadPayments() {
    setPayments((await api.get(`/schools/${s.id}/payments`)).data);
  }
  useEffect(() => { void loadPayments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s.id]);

  // The same sum the server does: the new time starts at whichever is latest of today and the current access end.
  const feeDue = s.termFee * terms;
  const startsFrom = new Date(Math.max(Date.now(), new Date(s.accessEndsAt).getTime()));
  const endsOn = new Date(startsFrom.getTime() + terms * s.termDays * DAY);
  const newDaysLeft = Math.ceil((endsOn.getTime() - Date.now()) / DAY);
  const amountValue = amount ?? String(feeDue);

  async function record() {
    setResult(null);
    const n = Number(amountValue);
    if (!n || n <= 0) return setResult({ ok: false, text: "Enter the amount received." });
    if (!reference.trim()) return setResult({ ok: false, text: "Enter the bank or teller reference (it must be unique)." });
    setBusy(true);
    try {
      const res = await api.post(`/schools/${s.id}/record-payment`, {
        amount: n, reference: reference.trim(), terms, termLabel: termLabel.trim() || undefined
      });
      const who = s.admins.map((a) => a.email).join(", ");
      setResult({
        ok: true,
        text: `Recorded (receipt ${res.data.receiptNo}). Access now ends ${fmt(res.data.subscriptionPaidUntil)}: ${res.data.daysLeft} days left. ${emailNote(res.data.receiptEmail, who)}`
      });
      setAmount(null); setReference(""); setTermLabel(""); setTerms(1);
      await Promise.all([loadPayments(), onChanged()]);
    } catch (err: any) {
      setResult({ ok: false, text: err.response?.data?.error || "Couldn't record the payment." });
    } finally {
      setBusy(false);
    }
  }

  async function emailReceipt(id: string) {
    try {
      const res = await api.post(`/schools/${s.id}/payments/${id}/send-receipt`);
      setResult({ ok: res.data.receiptEmail.sent > 0, text: emailNote(res.data.receiptEmail, s.admins.map((a) => a.email).join(", ")) });
    } catch (err: any) {
      setResult({ ok: false, text: err.response?.data?.error || "Couldn't send the receipt." });
    }
  }

  async function voidPayment(id: string) {
    try {
      const res = await api.post(`/schools/${s.id}/payments/${id}/void`, { reason: voidReason });
      setResult({ ok: true, text: res.data.message });
      setVoidingId(null); setVoidReason("");
      await Promise.all([loadPayments(), onChanged()]);
    } catch (err: any) {
      setResult({ ok: false, text: err.response?.data?.error || "Couldn't cancel the payment." });
    }
  }

  async function savePrice() {
    const raw = priceDraft.trim();
    try {
      await api.put(`/schools/${s.id}/pricing`, { pricePerStudent: raw === "" ? null : Number(raw) });
      setSettingsMsg(raw === "" ? "Price reset to the default." : `Price set to ₦${Number(raw).toLocaleString()} per student per term.`);
      setPriceDraft("");
      await onChanged();
    } catch (err: any) { setSettingsMsg(err.response?.data?.error || "Couldn't save the price."); }
  }

  async function saveAi() {
    const raw = aiDraft.trim();
    try {
      await api.put(`/schools/${s.id}/ai-limit`, { limit: raw === "" ? null : Number(raw) });
      setSettingsMsg(raw === "" ? "AI allowance reset to the platform default." : `AI allowance set to ${Number(raw).toLocaleString()} questions a month.`);
      setAiDraft("");
      await onChanged();
    } catch (err: any) { setSettingsMsg(err.response?.data?.error || "Couldn't save the AI allowance."); }
  }

  const paidThrough = s.subscriptionPaidUntil && new Date(s.subscriptionPaidUntil).getTime() > Date.now() ? s.subscriptionPaidUntil : null;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border)", fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
      {/* 1. where does access stand */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Access ends</p>
          <p style={{ fontSize: 20, fontWeight: 600, margin: "2px 0 0" }}>{fmt(s.accessEndsAt)}</p>
        </div>
        <DaysLeftBadge days={s.accessDaysLeft} />
      </div>
      <p style={{ color: "var(--text-secondary)", margin: "8px 0 0" }}>
        Free trial {new Date(s.trialEndsAt).getTime() > Date.now() ? "ends" : "ended"} {fmt(s.trialEndsAt)}
        {paidThrough ? ` · paid through ${fmt(paidThrough)}` : " · nothing paid yet"} · {s.studentCount} student{s.studentCount === 1 ? "" : "s"}
      </p>
      <p style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}>
        {s.admins.length === 0 ? "No admin yet" : `Admin: ${s.admins.map((a) => `${a.name} (${a.email})`).join(", ")}`}
      </p>

      {/* 2. record a payment */}
      <div style={section}>
        <p style={heading}>Record a payment</p>
        <label style={label}>1. How many terms is the school paying for?</label>
        <select value={terms} onChange={(e) => { setTerms(Number(e.target.value)); setAmount(null); }} style={{ width: "100%", marginBottom: 10 }}>
          {Array.from({ length: s.maxTerms }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} term{n === 1 ? "" : "s"} — adds {n * s.termDays} days</option>
          ))}
        </select>

        <div style={{ background: "var(--bg-neutral)", borderRadius: "var(--radius)", padding: 10, marginBottom: 10 }}>
          <p style={{ margin: 0 }}>Fee due: <b>₦{feeDue.toLocaleString()}</b>
            <span style={{ color: "var(--text-secondary)" }}> ({s.studentCount} × ₦{s.pricePerStudent.toLocaleString()} per term; a minimum fee may apply)</span></p>
          <p style={{ margin: "6px 0 0" }}>
            Access will run <b>{fmt(startsFrom)} → {fmt(endsOn)}</b>
            <span style={{ color: "var(--text-secondary)" }}> — {newDaysLeft} days left after this payment</span>
          </p>
        </div>

        <label style={label}>2. Amount received (₦)</label>
        <input type="number" value={amountValue} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
        <label style={label}>3. Bank or teller reference (must be unique)</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. the transfer reference or your receipt book number" style={{ width: "100%", marginBottom: 10 }} />
        <label style={label}>Note for the receipt (optional)</label>
        <input value={termLabel} onChange={(e) => setTermLabel(e.target.value)} placeholder="e.g. 2026/27 Term 1" style={{ width: "100%", marginBottom: 12 }} />
        <button type="button" onClick={record} disabled={busy} style={{ width: "100%", padding: "8px 12px", fontWeight: 600 }}>
          {busy ? "Recording…" : `Record ₦${Number(amountValue || 0).toLocaleString()} and extend access`}
        </button>
        {result && (
          <p style={{ marginTop: 10, padding: 10, borderRadius: "var(--radius)", color: result.ok ? "var(--text-success)" : "var(--text-danger)", background: result.ok ? "var(--bg-success)" : "var(--bg-danger)" }}>
            {result.text}
          </p>
        )}
      </div>

      {/* 3. history */}
      <div style={section}>
        <p style={heading}>Payment history</p>
        {payments === null && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
        {payments?.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No payments yet.</p>}
        {payments?.map((p) => (
          <div key={p.id} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--border)", opacity: p.status === "voided" ? 0.65 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 500, textDecoration: p.status === "voided" ? "line-through" : "none" }}>
                ₦{p.amount.toLocaleString()} · {p.terms ?? "?"} term{p.terms === 1 ? "" : "s"}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>{fmt(p.confirmedAt)} {p.status === "voided" && <Badge tone="danger">Cancelled</Badge>}</span>
            </div>
            <p style={{ margin: "2px 0 6px", color: "var(--text-secondary)", fontSize: 12 }}>
              {[p.receiptNo, `ref ${p.reference}`, p.termLabel].filter(Boolean).join(" · ")}
              {p.voidReason ? ` · reason: ${p.voidReason}` : ""}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link to={`/superadmin/receipt/${p.id}?school=${s.id}`}>Receipt</Link>
              {p.status === "applied" && <button type="button" onClick={() => emailReceipt(p.id)} style={{ padding: "2px 10px", fontSize: 12 }}>Email receipt</button>}
              {p.canVoid && voidingId !== p.id && <button type="button" onClick={() => { setVoidingId(p.id); setVoidReason(""); }} style={{ padding: "2px 10px", fontSize: 12 }}>Cancel payment</button>}
            </div>
            {voidingId === p.id && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <input placeholder="Why is it being cancelled? (required)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
                <button type="button" onClick={() => voidPayment(p.id)} style={{ padding: "3px 10px" }}>Confirm cancel</button>
                <button type="button" onClick={() => setVoidingId(null)} style={{ padding: "3px 10px" }}>Keep it</button>
              </div>
            )}
          </div>
        ))}
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
          Only the newest cash payment can be cancelled; the school's access goes back to what it was. To fix a mistake, cancel it and record the right payment.
        </p>
      </div>

      {/* 4. rarely needed */}
      <details style={section}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--text-primary)" }}>School settings: price and AI allowance</summary>
        <p style={{ margin: "10px 0 4px" }}>
          Price: ₦{s.pricePerStudent.toLocaleString()} per student per term {s.hasCustomPrice ? "(custom)" : "(default)"}
        </p>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <input type="number" placeholder="New price per student (₦) — empty = default" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} style={{ flex: 1 }} />
          <button type="button" onClick={savePrice} style={{ padding: "3px 10px" }}>Save</button>
        </div>
        <p style={{ margin: "0 0 4px" }}>
          AI this month: <b>{s.aiUsedThisMonth}</b> of {s.aiLimit.toLocaleString()} questions {s.hasCustomAiLimit ? "(custom)" : "(default)"} · est. cost ${s.aiCostUsdThisMonth.toFixed(4)} ({s.aiModel})
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" min={0} placeholder="Questions per month — empty = default, 0 = AI off" value={aiDraft} onChange={(e) => setAiDraft(e.target.value)} style={{ flex: 1 }} />
          <button type="button" onClick={saveAi} style={{ padding: "3px 10px" }}>Save</button>
        </div>
        {settingsMsg && <p style={{ marginTop: 8 }}>{settingsMsg}</p>}
      </details>
    </div>
  );
}

import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

interface SchoolRow {
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
  adminCount: number;
  admins: { name: string; email: string }[];
}

interface PaymentItem {
  id: string;
  status: "applied" | "voided";
  receiptNo: string | null;
  amount: number;
  reference: string;
  method: "nomba" | "manual";
  terms: number | null;
  termLabel: string | null;
  confirmedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  canVoid: boolean;
}

function expiryText(days: number): string {
  if (days < 0) return `ended ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "ends today";
  return `ends in ${days} day${days === 1 ? "" : "s"}`;
}

interface PaymentDraft {
  amount: string;
  reference: string;
  terms: string;
  termLabel: string;
  paidUntil: string;
}

const EMPTY_DRAFT: PaymentDraft = { amount: "", reference: "", terms: "1", termLabel: "", paidUntil: "" };

function billingBadge(s: SchoolRow): { tone: "success" | "warning" | "danger"; label: string } {
  const now = Date.now();
  const paidActive = s.subscriptionPaidUntil && new Date(s.subscriptionPaidUntil).getTime() > now;
  const trialActive = new Date(s.trialEndsAt).getTime() > now;
  if (paidActive) return { tone: "success", label: "Paid" };
  if (trialActive) return { tone: "warning", label: "Trial" };
  return { tone: "danger", label: "Expired" };
}

export default function SchoolManagement() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [paymentMessages, setPaymentMessages] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<Record<string, PaymentItem[]>>({});
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [onlyEnding, setOnlyEnding] = useState(false);

  async function loadSchools() {
    const res = await api.get("/schools");
    setSchools(res.data);
  }

  useEffect(() => {
    loadSchools();
  }, []);

  async function loadPayments(id: string) {
    const res = await api.get(`/schools/${id}/payments`);
    setPayments((prev) => ({ ...prev, [id]: res.data }));
  }

  async function handleVoid(schoolId: string, paymentId: string) {
    try {
      const res = await api.post(`/schools/${schoolId}/payments/${paymentId}/void`, { reason: voidReason });
      setPaymentMessages((prev) => ({ ...prev, [schoolId]: res.data.message }));
      setVoidingId(null);
      setVoidReason("");
      await Promise.all([loadPayments(schoolId), loadSchools()]);
    } catch (err: any) {
      setPaymentMessages((prev) => ({ ...prev, [schoolId]: err.response?.data?.error || "Couldn't cancel the payment." }));
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!schoolName || !adminName || !adminEmail || !adminPassword) {
      setError("Fill in every field before creating a school.");
      return;
    }
    try {
      await api.post("/schools", { schoolName, address, adminName, adminEmail, adminPassword });
      setSchoolName("");
      setAddress("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      await loadSchools();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't create the school.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await api.put(`/schools/${id}/active`, { isActive: !isActive });
    await loadSchools();
  }

  function draft(id: string): PaymentDraft {
    return paymentDrafts[id] || EMPTY_DRAFT;
  }

  function setField(id: string, field: keyof PaymentDraft, value: string) {
    setPaymentDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || EMPTY_DRAFT), [field]: value } }));
  }

  async function handleRecordPayment(id: string) {
    const d = draft(id);
    const amount = Number(d.amount);
    const terms = Number(d.terms);
    if (!amount || amount <= 0 || !d.reference.trim() || !Number.isInteger(terms) || terms < 1) {
      setPaymentMessages((prev) => ({ ...prev, [id]: "Enter the amount received, a unique reference (e.g. a receipt number) and the number of terms." }));
      return;
    }
    try {
      const res = await api.post(`/schools/${id}/record-payment`, {
        amount,
        reference: d.reference.trim(),
        terms,
        termLabel: d.termLabel.trim() || undefined,
        paidUntil: d.paidUntil ? new Date(`${d.paidUntil}T23:59:59`).toISOString() : undefined
      });
      setPaymentMessages((prev) => ({ ...prev, [id]: `${res.data.message} (receipt ${res.data.receiptNo}) — access until ${new Date(res.data.subscriptionPaidUntil).toLocaleDateString()}` }));
      setPaymentDrafts((prev) => ({ ...prev, [id]: EMPTY_DRAFT }));
      await Promise.all([loadSchools(), loadPayments(id)]);
    } catch (err: any) {
      setPaymentMessages((prev) => ({ ...prev, [id]: err.response?.data?.error || "Couldn't record the payment." }));
    }
  }

  async function handleSavePrice(id: string) {
    const raw = (priceDrafts[id] ?? "").trim();
    try {
      await api.put(`/schools/${id}/pricing`, { pricePerStudent: raw === "" ? null : Number(raw) });
      setPaymentMessages((prev) => ({ ...prev, [id]: raw === "" ? "Price reset to the default." : `Price set to ₦${Number(raw).toLocaleString()} per student per term.` }));
      setPriceDrafts((prev) => ({ ...prev, [id]: "" }));
      await loadSchools();
    } catch (err: any) {
      setPaymentMessages((prev) => ({ ...prev, [id]: err.response?.data?.error || "Couldn't save the price." }));
    }
  }

  return (
    <PageShell maxWidth={720}>
      <h1>Schools</h1>

      <Card style={{ marginBottom: 24 }}>
        <h3>Onboard a new school</h3>
        <form onSubmit={handleCreate}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required style={{ flex: 1 }} />
            <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input placeholder="Admin name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required style={{ flex: 1 }} />
            <input placeholder="Admin email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                placeholder="Admin password"
                type={showPassword ? "text" : "password"}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ padding: "0 10px", fontSize: 12 }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <PrimaryButton type="submit">Create school + admin</PrimaryButton>
        </form>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, marginBottom: 0 }}>
          New schools get a 90-day free trial automatically.
        </p>
      </Card>

      <h3>All schools ({schools.length})</h3>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" checked={onlyEnding} onChange={(e) => setOnlyEnding(e.target.checked)} />
        Only schools whose access ends within 30 days (or already ended)
      </label>
      {schools.filter((s) => !onlyEnding || s.accessDaysLeft <= 30).map((s) => {
        const isExpanded = expandedId === s.id;
        const badge = billingBadge(s);
        const d = draft(s.id);
        return (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => {
                setExpandedId(isExpanded ? null : s.id);
                if (!isExpanded && !payments[s.id]) loadPayments(s.id);
              }}
            >
              <div>
                <p style={{ fontWeight: 500 }}>{s.name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {s.address || "No address"} · {s.adminCount} admin{s.adminCount !== 1 ? "s" : ""} · access {expiryText(s.accessDaysLeft)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(s.id, s.isActive);
                  }}
                >
                  {s.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
                <p>Created: {new Date(s.createdAt).toLocaleString()}</p>
                <p>Trial ends: {new Date(s.trialEndsAt).toLocaleDateString()}</p>
                {s.subscriptionPaidUntil && <p>Paid until: {new Date(s.subscriptionPaidUntil).toLocaleDateString()}</p>}
                <p style={{ marginTop: 6 }}>Admins:</p>
                {s.admins.length === 0 && <p>None</p>}
                {s.admins.map((a) => (
                  <p key={a.email}>{a.name} — {a.email}</p>
                ))}

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                  <p style={{ fontWeight: 500, marginBottom: 4, color: "var(--text-primary)" }}>Fee per term</p>
                  <p style={{ marginBottom: 6 }}>
                    {s.studentCount} student{s.studentCount === 1 ? "" : "s"} × ₦{s.pricePerStudent.toLocaleString()}
                    {s.hasCustomPrice ? " (custom price)" : " (default price)"} = <strong>₦{s.termFee.toLocaleString()}</strong> per term
                    {" "}(a minimum fee may apply)
                  </p>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <input
                      placeholder="Custom price per student (₦) — empty = default"
                      type="number"
                      value={priceDrafts[s.id] ?? ""}
                      onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSavePrice(s.id)} style={{ padding: "3px 10px" }}>Save price</button>
                  </div>

                  <p style={{ fontWeight: 500, marginBottom: 6, color: "var(--text-primary)" }}>Record a payment (cash or transfer)</p>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <input
                      placeholder={`Amount received (₦) — one term is ₦${s.termFee.toLocaleString()}`}
                      type="number"
                      value={d.amount}
                      onChange={(e) => setField(s.id, "amount", e.target.value)}
                      style={{ flex: 2, minWidth: 160 }}
                    />
                    <input
                      placeholder="Reference (receipt no., must be unique)"
                      value={d.reference}
                      onChange={(e) => setField(s.id, "reference", e.target.value)}
                      style={{ flex: 2, minWidth: 160 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={d.terms} onChange={(e) => setField(s.id, "terms", e.target.value)}>
                      <option value="1">1 term</option>
                      <option value="2">2 terms</option>
                      <option value="3">3 terms (full year)</option>
                    </select>
                    <input
                      placeholder="Label, e.g. 2026/27 Term 1 (optional)"
                      value={d.termLabel}
                      onChange={(e) => setField(s.id, "termLabel", e.target.value)}
                      style={{ flex: 1, minWidth: 160 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ marginBottom: 0, fontSize: 12 }}>Access until (optional — leave empty for the standard term length)</label>
                    <input type="date" value={d.paidUntil} onChange={(e) => setField(s.id, "paidUntil", e.target.value)} />
                    <button type="button" onClick={() => handleRecordPayment(s.id)} style={{ padding: "3px 10px" }}>
                      Record payment
                    </button>
                  </div>
                  {paymentMessages[s.id] && <p style={{ marginBottom: 6 }}>{paymentMessages[s.id]}</p>}

                  <p style={{ fontWeight: 500, margin: "12px 0 6px", color: "var(--text-primary)" }}>Payments</p>
                  {(payments[s.id] || []).length === 0 && <p>No payments recorded yet.</p>}
                  {(payments[s.id] || []).map((p) => (
                    <div key={p.id} style={{ marginBottom: 8, opacity: p.status === "voided" ? 0.6 : 1 }}>
                      <p style={{ marginBottom: 2, textDecoration: p.status === "voided" ? "line-through" : "none" }}>
                        ₦{p.amount.toLocaleString()} · {p.receiptNo ? `${p.receiptNo} · ` : ""}ref {p.reference} · {new Date(p.confirmedAt).toLocaleDateString()}
                        {p.status === "voided" && <> <Badge tone="danger">Cancelled</Badge></>}
                      </p>
                      <p style={{ marginBottom: 0 }}>
                        <Link to={`/superadmin/receipt/${p.id}?school=${s.id}`}>Receipt</Link>
                        {p.canVoid && voidingId !== p.id && (
                          <> · <button type="button" onClick={() => { setVoidingId(p.id); setVoidReason(""); }} style={{ padding: "1px 8px", fontSize: 12 }}>Cancel this payment</button></>
                        )}
                        {p.voidReason && <> · reason: {p.voidReason}</>}
                      </p>
                      {voidingId === p.id && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <input placeholder="Why is it being cancelled? (required)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} style={{ flex: 1 }} />
                          <button type="button" onClick={() => handleVoid(s.id, p.id)} style={{ padding: "3px 10px" }}>Confirm cancel</button>
                          <button type="button" onClick={() => setVoidingId(null)} style={{ padding: "3px 10px" }}>Keep it</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 0 }}>
                    Only the newest cash payment can be cancelled; the school's access date goes back to what it was. To correct a mistake, cancel it and record the right payment (the same receipt number can be used again).
                  </p>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </PageShell>
  );
}
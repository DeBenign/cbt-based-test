import { useEffect, useState, FormEvent } from "react";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";

interface PaymentRow {
  amount: number;
  reference: string;
  method: "nomba" | "manual";
  terms: number | null;
  termLabel: string | null;
  periodMonths: number | null; // only on payments recorded before billing moved to per-term
  confirmedAt: string;
}

interface BillingStatus {
  subscriptionStatus: string;
  trialEndsAt: string;
  trialDaysLeft: number;
  isTrialActive: boolean;
  subscriptionPaidUntil?: string;
  isPaidActive: boolean;
  accessBlocked: boolean;
  studentCount: number;
  pricePerStudent: number;
  termFee: number;
  termDays: number;
  onlinePaymentsEnabled: boolean;
  payments: PaymentRow[];
}

function describePayment(p: PaymentRow): string {
  const covers = p.terms
    ? `${p.terms} term${p.terms === 1 ? "" : "s"}`
    : p.periodMonths
      ? `${p.periodMonths} month${p.periodMonths === 1 ? "" : "s"}`
      : "";
  return [p.termLabel, covers, p.method === "nomba" ? "online" : "cash/transfer", `ref ${p.reference}`, new Date(p.confirmedAt).toLocaleDateString()]
    .filter(Boolean)
    .join(" · ");
}

export default function Billing() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(1);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api
      .get("/billing/status")
      .then((res) => setStatus(res.data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load billing status."));
  }, []);

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    setPayError(null);
    setPaying(true);
    try {
      const res = await api.post("/billing/pay", { terms });
      window.location.href = res.data.checkoutLink;
    } catch (err: any) {
      setPayError(err.response?.data?.error || "Couldn't start payment. Please try again.");
      setPaying(false);
    }
  }

  if (error) {
    return (
      <PageShell maxWidth={520}>
        <h1>Billing</h1>
        <p style={{ color: "var(--text-danger)" }}>{error}</p>
      </PageShell>
    );
  }

  if (!status) {
    return (
      <PageShell maxWidth={520}>
        <h1>Billing</h1>
        <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}><Spinner />Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={520}>
      <h1>Billing</h1>

      <Card style={{ marginBottom: 20 }}>
        {status.accessBlocked ? (
          <>
            <Badge tone="danger">Access locked</Badge>
            <p style={{ marginTop: 10 }}>
              Your school's free trial has ended and no payment is on file. Setup, Users, Questions, Exams and the
              other admin pages are locked.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Teachers and students can't sign in</strong> until payment is confirmed. Anyone who is already
              signed in can carry on until their session ends (up to 8 hours).
            </p>
          </>
        ) : status.isPaidActive ? (
          <>
            <Badge tone="success">Active subscription</Badge>
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              Paid through <strong>{new Date(status.subscriptionPaidUntil!).toLocaleDateString()}</strong>.
            </p>
          </>
        ) : (
          <>
            <Badge tone="warning">Free trial — {status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} left</Badge>
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              Trial ends <strong>{new Date(status.trialEndsAt).toLocaleDateString()}</strong>. After that, teachers and
              students can't sign in until the school pays for a term.
            </p>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3>Your fee per term</h3>
        <p style={{ marginBottom: 6 }}>
          {status.studentCount} student{status.studentCount === 1 ? "" : "s"} × ₦{status.pricePerStudent.toLocaleString()} ={" "}
          <strong>₦{status.termFee.toLocaleString()}</strong> per term
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 0 }}>
          Billed per school term, not per month. One term of access lasts about {status.termDays} days, so it covers the
          term and the holiday after it. The fee follows your current number of student accounts. A minimum fee applies to
          small schools.
        </p>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3>How to pay</h3>
        <p style={{ marginBottom: 6 }}>
          <strong>Cash or bank transfer:</strong> pay the amount above to the platform owner and keep your receipt. They
          record the payment, and your access updates straight away — no need to sign out and in again.
        </p>

        {status.onlinePaymentsEnabled && (
          <form onSubmit={handlePay} style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--border)" }}>
            <p style={{ fontWeight: 500, marginBottom: 6 }}>Or pay online with Nomba</p>
            <select value={terms} onChange={(e) => setTerms(Number(e.target.value))} style={{ width: "100%", marginBottom: 12 }}>
              <option value={1}>1 term — ₦{status.termFee.toLocaleString()}</option>
              <option value={2}>2 terms — ₦{(status.termFee * 2).toLocaleString()}</option>
              <option value={3}>3 terms (full year) — ₦{(status.termFee * 3).toLocaleString()}</option>
            </select>
            {payError && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 10 }}>{payError}</p>}
            <PrimaryButton type="submit" disabled={paying} style={{ width: "100%" }}>
              {paying ? "Redirecting to Nomba…" : "Pay now"}
            </PrimaryButton>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, marginBottom: 0 }}>
              You'll be taken to Nomba's secure checkout. Your access updates automatically once payment is confirmed.
            </p>
          </form>
        )}
      </Card>

      <h3>Payment history</h3>
      {status.payments.length === 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No payments recorded yet.</p>
      )}
      {status.payments.map((p) => (
        <Card key={p.reference} style={{ marginBottom: 8 }}>
          <p style={{ fontWeight: 500, marginBottom: 2 }}>₦{p.amount.toLocaleString()}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 0 }}>{describePayment(p)}</p>
        </Card>
      ))}
    </PageShell>
  );
}

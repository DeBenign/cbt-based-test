import { useEffect, useState } from "react";
import api from "../services/api";
import Card from "../components/Card";
import PublicLayout from "../components/PublicLayout";
import { CONTACT } from "../utils/contact";

interface PricingInfo {
  pricePerStudentPerTerm: number;
  minTermFee: number;
  termDays: number;
  trialDays: number;
  maxTermsPerPayment: number;
  onlinePaymentsEnabled: boolean;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const INCLUDED = [
  "Question bank for every class and subject",
  "AI-drafted questions from your own curriculum (teachers review before use)",
  "Timed exams with shuffled questions and automatic saving",
  "Tab-switching and full-screen checks during exams",
  "Instant marking for multiple choice; a screen for teachers to grade theory",
  "Results, class averages and spreadsheet (CSV) export",
  "Upload students and teachers from a file",
  "Your school's logo and colours",
  "Activity log, and admin corrections that record a reason",
  "Numbered receipts and email reminders before access ends"
];

const FAQ: [string, string][] = [
  ["What counts as a student?", "Only student accounts. Your admins and teachers are free."],
  ["What happens after the free trial?", "The school admin can still sign in and open Billing. Teachers and students can sign in again as soon as a payment is recorded. Nothing is deleted."],
  ["Can we pay before the term ends?", "Yes. New time is added on top of what you have left, so paying early never loses days."],
  ["Can we pay for more than one term?", "Yes, up to a full school year (3 terms) in one payment."],
  ["How do we pay?", "By cash or bank transfer: we tell you the amount and our account details, record your payment, and send a numbered receipt. Access renews at once."],
  ["Do bigger schools get a discount?", "We can agree a custom price per student for larger schools or groups of schools. Contact us."]
];

export default function Pricing() {
  const [info, setInfo] = useState<PricingInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [students, setStudents] = useState(300);

  useEffect(() => {
    api.get("/public/pricing").then((r) => setInfo(r.data)).catch(() => setFailed(true));
  }, []);

  const fee = (n: number) => (info ? Math.max(info.minTermFee, Math.round(n * info.pricePerStudentPerTerm)) : 0);
  const count = Math.max(0, Math.floor(students) || 0);

  return (
    <PublicLayout>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Simple pricing. Pay per student, once a term.</h1>
      <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 24 }}>
        One price, every feature. No setup fee, no per-exam charge, and no card needed to start.
      </p>

      {failed && <Card style={{ marginBottom: 20 }}>We couldn't load today's prices. Please <a href={`mailto:${CONTACT.email}`}>email us</a> or call {CONTACT.phoneDisplay}.</Card>}

      {info && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <Card style={{ background: "var(--accent)", color: "#fff", borderColor: "transparent" }}>
              <p style={{ opacity: 0.9, marginBottom: 4 }}>First {info.trialDays} days</p>
              <p style={{ fontSize: 30, fontWeight: 800, marginBottom: 4, color: "#fff" }}>Free</p>
              <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 0 }}>We set up your school and train your first teachers.</p>
            </Card>
            <Card>
              <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>After that</p>
              <p style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{naira(info.pricePerStudentPerTerm)}</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>per student, per term</p>
            </Card>
            <Card>
              <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Smallest fee</p>
              <p style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{naira(info.minTermFee)}</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>per term, however small the school</p>
            </Card>
          </div>

          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 6 }}>Work out your fee</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Students × {naira(info.pricePerStudentPerTerm)} = your fee for the term (never below {naira(info.minTermFee)}).</p>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              How many students?
              <input type="number" min={0} value={students} onChange={(e) => setStudents(Number(e.target.value))} style={{ width: 120 }} />
            </label>
            <p style={{ fontSize: 26, fontWeight: 800, marginBottom: 2 }}>{naira(fee(count))} <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-secondary)" }}>per term</span></p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>
              One payment covers a term and the holiday after it (about {info.termDays} days).
            </p>
            <table style={{ width: "100%", fontSize: 13, marginTop: 14, borderCollapse: "collapse" }}>
              <tbody>
                {[20, 100, 300, 500, 1000].map((n) => (
                  <tr key={n} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 0" }}>{n} students</td>
                    <td style={{ padding: "6px 0", textAlign: "right" }}>{naira(fee(n))} per term</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <h2 style={{ marginBottom: 10 }}>How paying works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <Card><p style={{ fontWeight: 600 }}>1. We tell you the amount</p><p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>Based on your student accounts. Your Billing page always shows it.</p></Card>
            <Card><p style={{ fontWeight: 600 }}>2. You pay</p><p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>By cash or bank transfer.{info.onlinePaymentsEnabled ? " Online payment by card or transfer is also available." : " Online card payment is coming soon."}</p></Card>
            <Card><p style={{ fontWeight: 600 }}>3. Access renews</p><p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>We record it, you get a numbered receipt, and everyone keeps working. We email your admin before access ends.</p></Card>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: 10 }}>Everything is included</h2>
      <Card style={{ marginBottom: 24 }}>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14 }}>
          {INCLUDED.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Card>

      <h2 style={{ marginBottom: 10 }}>Questions</h2>
      {FAQ.map(([q, a]) => (
        <Card key={q} style={{ marginBottom: 10 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{q}</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 0 }}>{a}</p>
        </Card>
      ))}

      <Card style={{ marginTop: 24, textAlign: "center" }}>
        <h3 style={{ marginBottom: 6 }}>Start your free trial</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Accounts are created for you. Tell us your school and we'll set it up.</p>
        <p style={{ marginBottom: 0 }}>
          <a href={CONTACT.whatsapp}>WhatsApp</a> · <a href={`tel:${CONTACT.phoneIntl}`}>{CONTACT.phoneDisplay}</a> · <a href={`mailto:${CONTACT.email}?subject=Free%20trial%20for%20my%20school`}>{CONTACT.email}</a>
        </p>
      </Card>
    </PublicLayout>
  );
}

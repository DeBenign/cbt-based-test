import { useEffect, useState, FormEvent } from "react";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import DaysLeftBadge from "../components/DaysLeftBadge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import SchoolPanel, { SchoolRow } from "../components/SchoolPanel";

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
  const [onlyEnding, setOnlyEnding] = useState(false);
  const [mailTest, setMailTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [mailTesting, setMailTesting] = useState(false);

  async function handleMailTest() {
    setMailTesting(true);
    setMailTest(null);
    try {
      const res = await api.post("/schools/mail-test");
      setMailTest({ ok: res.data.ok, text: res.data.message });
    } catch (err: any) {
      setMailTest({ ok: false, text: err.response?.data?.error || "Couldn't run the email check." });
    } finally {
      setMailTesting(false);
    }
  }

  async function loadSchools() {
    const res = await api.get("/schools");
    setSchools(res.data);
  }

  useEffect(() => {
    loadSchools();
  }, []);

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

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 2 }}>Email check</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Receipts, password resets and reminders all depend on email. Send yourself a test to see if it works on the live site.</p>
          </div>
          <button type="button" onClick={handleMailTest} disabled={mailTesting}>{mailTesting ? "Checking…" : "Send test email"}</button>
        </div>
        {mailTest && (
          <p style={{ marginTop: 10, marginBottom: 0, padding: 10, borderRadius: "var(--radius)", fontSize: 13, color: mailTest.ok ? "var(--text-success)" : "var(--text-danger)", background: mailTest.ok ? "var(--bg-success)" : "var(--bg-danger)" }}>
            {mailTest.text}
          </p>
        )}
      </Card>

      <h3>All schools ({schools.length})</h3>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" checked={onlyEnding} onChange={(e) => setOnlyEnding(e.target.checked)} />
        Only schools whose access ends within 30 days (or already ended)
      </label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        {schools.filter((s) => s.accessDaysLeft <= 30).length} of {schools.length} school(s) end within 30 days or have already ended.
      </p>
      {schools.filter((s) => !onlyEnding || s.accessDaysLeft <= 30).map((s) => {
        const isExpanded = expandedId === s.id;
        const badge = billingBadge(s);
        return (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 10, flexWrap: "wrap" }}
              onClick={() => setExpandedId(isExpanded ? null : s.id)}
            >
              <div>
                <p style={{ fontWeight: 500 }}>{s.name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {s.address || "No address"} · {s.studentCount} student{s.studentCount === 1 ? "" : "s"} · ends {new Date(s.accessEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <DaysLeftBadge days={s.accessDaysLeft} />
                <Badge tone={badge.tone}>{badge.label}</Badge>
                {!s.isActive && <Badge tone="danger">Deactivated</Badge>}
                <button onClick={(e) => { e.stopPropagation(); handleToggleActive(s.id, s.isActive); }} style={{ padding: "3px 10px", fontSize: 12 }}>
                  {s.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            {isExpanded && <SchoolPanel school={s} onChanged={loadSchools} />}
          </Card>
        );
      })}
    </PageShell>
  );
}

import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function ResetPassword() {
  // Read the link's code once, then remove it from the address bar so it
  // doesn't linger in browser history or get copied along with the URL.
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
    } catch (err: any) {
      setError(err.response ? err.response.data?.error || "Couldn't reset the password." : "Can't reach the server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell maxWidth={380}>
      <Card>
        <h2 style={{ textAlign: "center", marginBottom: 16 }}>Choose a new password</h2>
        {done ? (
          <>
            <p style={{ color: "var(--text-success)", fontSize: 13 }}>Password changed. You can sign in now.</p>
            <p style={{ textAlign: "center", marginBottom: 0 }}><Link to="/login">Go to sign in</Link></p>
          </>
        ) : !token ? (
          <>
            <p style={{ color: "var(--text-danger)", fontSize: 13 }}>This reset link is incomplete. Request a new one.</p>
            <p style={{ textAlign: "center", marginBottom: 0 }}><Link to="/forgot-password">Request a new link</Link></p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label>New password</label>
              <input type={show ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ width: "100%" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Confirm new password</label>
              <input type={show ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ width: "100%" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13 }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>
            {error && (
              <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>
                {error} <Link to="/forgot-password">Request a new link</Link>
              </p>
            )}
            <PrimaryButton type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Saving…" : "Save new password"}
            </PrimaryButton>
          </form>
        )}
      </Card>
    </PageShell>
  );
}

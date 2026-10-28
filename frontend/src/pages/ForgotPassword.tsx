import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { identifier });
      setMessage(res.data.message);
    } catch (err: any) {
      setError(err.response ? err.response.data?.error || "Couldn't send the link." : "Can't reach the server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell maxWidth={380}>
      <Card>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>Forgot password</h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
          We'll email you a link to choose a new one.
        </p>
        {message ? (
          <p style={{ color: "var(--text-success)", fontSize: 13 }}>{message}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label>Email or username</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                required
                style={{ width: "100%" }}
              />
            </div>
            {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <PrimaryButton type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Sending…" : "Send reset link"}
            </PrimaryButton>
          </form>
        )}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>
          No email on your account (most students)? Ask your teacher or school admin to reset it for you.
        </p>
        <p style={{ textAlign: "center", fontSize: 13, marginTop: 10, marginBottom: 0 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </Card>
    </PageShell>
  );
}

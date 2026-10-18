import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { identifier, password });
      login(res.data.token, res.data.user);
      const role = res.data.user.role;
      if (res.data.user.mustChangePassword) {
        navigate(`/${role}/change-password`);
        return;
      }
      if (role === "superadmin") navigate(`/${role}/schools`);
      else navigate(role === "student" ? `/${role}/exams` : `/${role}/questions`);
    } catch (err: any) {
      if (!err.response) {
        setError("Can't reach the server. Please try again in a moment.");
      } else {
        setError(err.response.data?.error || "Couldn't log in. Check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell maxWidth={380}>
      <Card>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>Sign in</h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
          School CBT
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label>Email or username</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@school.com or your username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ padding: "0 10px", fontSize: 12 }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <PrimaryButton type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>
          Don't have an account? Ask your school admin to set one up for you.
        </p>
      </Card>
    </PageShell>
  );
}
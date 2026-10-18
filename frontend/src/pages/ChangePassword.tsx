import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function ChangePassword() {
  const { user, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setSuccess("Password changed.");
      if (forced) {
        clearMustChangePassword();
        navigate(user?.role === "student" ? `/${user.role}/exams` : `/${user?.role}/questions`, { replace: true });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't change the password.");
    }
  }

  return (
    <PageShell maxWidth={420}>
      <h1>{forced ? "Choose your own password" : "Change password"}</h1>
      {forced && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          You signed in with a temporary password. Set a new one to continue — use the temporary password as the "current" one.
        </p>
      )}
      <Card>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Current password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>New password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Confirm new password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13 }}>
            <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
            Show passwords
          </label>
          {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          {success && <p style={{ color: "var(--text-success)", fontSize: 13, marginBottom: 10 }}>{success}</p>}
          <PrimaryButton type="submit">Change password</PrimaryButton>
        </form>
      </Card>
    </PageShell>
  );
}
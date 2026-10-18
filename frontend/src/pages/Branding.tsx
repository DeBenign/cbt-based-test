import { useEffect, useState, FormEvent } from "react";
import api from "../services/api";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function Branding() {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3D5AFE");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.get("/branding").then((res) => {
      if (res.data.logoUrl) setLogoUrl(res.data.logoUrl);
      if (res.data.primaryColor) setPrimaryColor(res.data.primaryColor);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.put("/branding", { logoUrl: logoUrl || undefined, primaryColor });
      setSuccess("Branding updated. Refresh to see it everywhere.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't update branding.");
    }
  }

  return (
    <PageShell maxWidth={480}>
      <h1>Branding</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Your logo needs to already be hosted somewhere — paste a direct link to the image (e.g. from
        Cloudinary, Imgur, or your own website). There's no file upload here yet.
      </p>
      <Card>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label>Logo image URL (optional)</label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Primary color</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 48, height: 36, padding: 0, border: "none" }}
              />
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          {success && <p style={{ color: "var(--text-success)", fontSize: 13, marginBottom: 10 }}>{success}</p>}
          <PrimaryButton type="submit">Save branding</PrimaryButton>
        </form>
      </Card>
    </PageShell>
  );
}
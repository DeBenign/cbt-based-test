import { Link } from "react-router-dom";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";

const features = [
  {
    title: "Question bank",
    desc: "Teachers build a reusable bank of multiple-choice questions, tagged by subject, topic and difficulty."
  },
  {
    title: "Exam builder",
    desc: "Create an exam in minutes. Pick questions manually or auto-fill from the bank, set duration and schedule."
  },
  {
    title: "Timed test-taking",
    desc: "Students answer against a server-controlled countdown. Answers auto-save as you go, even on a shaky connection."
  },
  {
    title: "Instant results",
    desc: "MCQs are auto-graded on submit. Teachers and Students see score and the class average after 1 Hour."
  }
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          background: "var(--gradient-hero)",
          padding: "72px 20px 90px",
          textAlign: "center",
          color: "#fff"
        }}
      >
        <h1 style={{ fontSize: 32, color: "#fff", marginBottom: 10 }}>Computer-Based Test</h1>
        <p style={{ maxWidth: 480, margin: "0 auto 26px", opacity: 0.92 }}>
          A lightweight CBT platform built for Schools question banking, exam scheduling,
          timed test-taking, and instant results, all in one place.
        </p>
        <Link to="/login">
          <button
            style={{
              padding: "12px 28px",
              background: "#fff",
              color: "var(--accent)",
              border: "none",
              boxShadow: "var(--shadow-md)"
            }}
          >
            Sign in
          </button>
        </Link>
      </div>

      <div style={{ maxWidth: 720, margin: "-48px auto 60px", padding: "0 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
          {features.map((f) => (
            <Card key={f.title}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 0 }}>{f.desc}</p>
            </Card>
          ))}
        </div>

        <Card style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Don't have login details?</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
            There's no public sign-up, accounts are created by your school admin. If you're a teacher or
            student, ask your school administrator to set up your account.
          </p>
          <Link to="/login">
            <PrimaryButton type="button">Go to sign in</PrimaryButton>
          </Link>
        </Card>
      </div>
    </div>
  );
}
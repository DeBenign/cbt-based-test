import { ReactNode } from "react";
import Card from "../components/Card";
import PublicLayout from "../components/PublicLayout";
import { CONTACT } from "../utils/contact";

const UPDATED = "1 November 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)" }}>{children}</div>
    </Card>
  );
}

const ul = { margin: "6px 0 0", paddingLeft: 20 } as const;

export default function Privacy() {
  return (
    <PublicLayout>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Privacy policy</h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 6 }}>
        In plain words: what {CONTACT.name} keeps about your school, your teachers and your students, why, who helps us run it, and what you can ask us to do.
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Last updated {UPDATED}</p>

      <Section title="The short version">
        <ul style={ul}>
          <li>We keep only what is needed to run exams, show results, and bill your school.</li>
          <li>We never sell data and we show no advertising. The app has no advertising or tracking scripts.</li>
          <li>Each school's data is kept apart from every other school's.</li>
          <li>Students see only their own results. Passwords are stored scrambled, never readable.</li>
          <li>Your school can ask us to export or delete its data at any time.</li>
        </ul>
      </Section>

      <Section title="Who is responsible for the data">
        Your school decides which students and staff use the platform, so the school is responsible for having the right to use their information (for students, usually parent or guardian consent). {CONTACT.name} processes that information on the school's behalf and only to provide the service.
      </Section>

      <Section title="What we keep">
        <ul style={ul}>
          <li><b>School:</b> name, address, logo and colours, billing records (amount, reference, date, receipt).</li>
          <li><b>Staff and students:</b> name, email or username, role, class, and a password stored only as a one-way scramble (hash).</li>
          <li><b>Exams:</b> questions, answers, marks, and when each attempt started and ended.</li>
          <li><b>Exam integrity:</b> a note when someone leaves the exam tab or full screen, so teachers can review it.</li>
          <li><b>Activity log:</b> which admin or teacher did what and when, so mistakes can be traced and corrected.</li>
          <li><b>Sign-in protection:</b> your internet address and the account you tried, held for only a few minutes to block repeated guessing.</li>
        </ul>
        <p style={{ marginTop: 8, marginBottom: 0 }}>We do <b>not</b> keep card numbers. Online payments, when switched on, are handled by our payment provider, Nomba.</p>
      </Section>

      <Section title="How we use it">
        To run exams and show results to the right people, to bill and send receipts, to send password-reset links and reminders that your access is about to end, to keep the service secure, and to help when you contact us.
      </Section>

      <Section title="AI question drafts">
        When a teacher asks for AI-drafted questions, we send only the curriculum text they uploaded, plus the subject and class names, to Anthropic's AI service to write the draft. No student names, answers or marks are sent. Please do not put personal information in curriculum files. Teachers review every question before it can be used.
      </Section>

      <Section title="Who helps us run the service">
        <ul style={ul}>
          <li><b>Vercel</b> hosts the website and server.</li>
          <li><b>MongoDB Atlas</b> stores the database.</li>
          <li><b>Anthropic</b> drafts questions when a teacher asks (see above).</li>
          <li><b>Our email provider</b> delivers reset links and reminders to the email address on the account.</li>
          <li><b>Nomba</b> processes online payments, when enabled.</li>
        </ul>
        <p style={{ marginTop: 8, marginBottom: 0 }}>These providers may process data outside Nigeria. We share nothing with anyone else unless the law requires it.</p>
      </Section>

      <Section title="Students and children">
        Students use the platform because their school asked them to. Students can only see their own exams and results. We do not contact students for marketing and we do not build profiles of them.
      </Section>

      <Section title="How we protect it">
        <ul style={ul}>
          <li>Everything travels over encrypted connections (HTTPS).</li>
          <li>Passwords are scrambled; temporary passwords must be replaced at first sign-in.</li>
          <li>Access depends on role (admin, teacher, student), and a school can never open another school's data.</li>
          <li>Repeated wrong passwords are slowed down, and changing a password signs the account out elsewhere.</li>
        </ul>
        <p style={{ marginTop: 8, marginBottom: 0 }}>No system is perfectly safe. If we learn of a breach that affects you, we will tell the school without delay.</p>
      </Section>

      <Section title="How long we keep it, and deleting it">
        We keep a school's data while it uses the service. A school admin can delete individual accounts. To export or delete all of a school's data, or to close the account, email us; we will act within 30 days and confirm in writing. Billing records may be kept longer where the law or our accounts require it.
      </Section>

      <Section title="Your rights">
        Under the Nigeria Data Protection Act 2023 you can ask to see, correct or delete your information, or object to how it is used. Students and parents can ask through their school, or contact us directly. You may also complain to the Nigeria Data Protection Commission.
      </Section>

      <Section title="Browser storage">
        We save a sign-in token and your preferences in your browser, and the app stores its own files on your device so it loads quickly. We do not use advertising cookies.
      </Section>

      <Section title="Changes and contact">
        If we change this policy we will update the date above, and tell schools about important changes. Questions or requests:{" "}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a href={`tel:${CONTACT.phoneIntl}`}>{CONTACT.phoneDisplay}</a>
      </Section>
    </PublicLayout>
  );
}

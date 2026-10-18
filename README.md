# School CBT

A multi-school computer-based test platform. Schools get their own admin, teachers and students;
teachers build exams (by hand or with AI from an uploaded curriculum); students sit them in a locked-down,
auto-saving browser session; MCQs are graded instantly and theory answers go to a teacher's grading queue.
Schools are billed **per student, per school term**.

- **Backend:** Node.js, TypeScript, Express, MongoDB (Mongoose) — deployed as a Vercel serverless function
- **Frontend:** React, TypeScript, Vite (installable PWA)
- **Every record carries a `schoolId`**, so schools are fully isolated from each other.

```
backend/   API (src/controllers, models, routes, services, middleware, utils, scripts)
frontend/  Web app (src/pages, components, context, services)
docs/      TESTING.md — step-by-step end-to-end test checklist
```

## Who does what

| Role | Can do |
|------|--------|
| **Superadmin** (platform owner) | Create schools and their first admin, set a school's price, record cash payments, activate/deactivate schools |
| **School admin** | Set up classes and subjects, add users (single or bulk upload), upload curricula, view all activity, correct problems (reopen, reset, regrade, override marks), manage branding and billing |
| **Teacher** | Add curricula for their subjects, write questions or generate AI drafts and approve them, build and publish exams, grade theory answers, see results |
| **Student** | Sign in (email or username), take scheduled exams, see their results |

## How it works, start to end

1. **Superadmin** creates a school and its admin → a **90-day free trial** starts.
2. **Admin** signs in → **Setup** (classes, subjects, link subjects to classes, assign teachers) → **Users** (bulk upload or add one by one; download the login sheet) → **Curriculum** (per class and subject).
3. **Everyone** signs in with their temporary password and is asked to choose their own.
4. **Teacher** builds a question bank: by hand, or **AI questions** → generate drafts from a curriculum → review/edit → approve.
5. **Teacher** creates an exam (class, subject, time window, duration, lockdown on/off; questions and options are always shuffled per student), attaches or auto-fills questions, publishes.
6. **Student** opens the exam inside its window → fullscreen lockdown, integrity events recorded, answers autosave every 15 seconds, a server-side timer decides the deadline → submit (or auto-submit at time-up). MCQs are marked at once.
7. **Teacher** grades theory answers in the grading queue; results appear for teacher, admin and student.
8. **Admin** uses **Activity** to see who did what and to fix problems; every correction needs a written reason and is logged.
9. **Billing:** when the trial ends the school pays for a term (see below).

## Run locally

Requires a recent Node.js (20 or newer) and a MongoDB database (local or Atlas).

```bash
# backend
cd backend
npm install
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET at minimum
npm run seed:superadmin     # one-time: creates the platform owner (needs SUPERADMIN_* in .env)
npm run dev                 # http://localhost:5050

# frontend (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The frontend talks to `http://localhost:5050/api/v1` unless `VITE_API_URL` is set. There are no demo accounts:
sign in as the superadmin, create a school (which creates its admin), then follow `docs/TESTING.md`.

If Vite starts on a different port (5174, …) because 5173 is busy, the browser will block API calls with a CORS error.
Free port 5173, or set `FRONTEND_URL` in `backend/.env` to the address you actually use.

## Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string. Never commit a real one |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing key and lifetime (default `8h`) |
| `FRONTEND_URL` | Exact URL of the deployed frontend, no trailing slash (CORS). `http://localhost:5173` is always allowed |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | AI question generation. Without a key the feature shows a clear "not switched on" message |
| `PRICE_PER_STUDENT_PER_TERM` | Default fee per student per term, in naira (placeholder: 500) |
| `MIN_TERM_FEE` | Smallest fee a school pays per term (placeholder: 15000) |
| `TERM_DAYS` | Length of one paid term of access (default 120 days) |
| `ONLINE_PAYMENTS_ENABLED` | `true` only once the Nomba webhook works. Until then schools pay cash |
| `NOMBA_BASE_URL`, `NOMBA_CLIENT_ID`, `NOMBA_CLIENT_SECRET`, `NOMBA_ACCOUNT_ID` | Nomba gateway |
| `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Used once by `npm run seed:superadmin` |

Frontend: `VITE_API_URL` — the backend address ending in `/api/v1`.

## Deploying on Vercel

Two Vercel projects from the same repo:

- **Backend** — root directory `backend`. Add every variable above. `backend/vercel.json` routes all traffic to `api/index.ts` and sets a 60-second function limit (needed for AI generation).
- **Frontend** — root directory `frontend`. Set `VITE_API_URL` to the backend URL + `/api/v1`. Changing it needs a redeploy because it is baked in at build time.

After changing any environment variable, redeploy that project. A "Ready" deployment can still crash at runtime — check **Logs**.

## Billing

- **Trial:** 90 days from the day the school is created.
- **After the trial:** the admin can only reach Billing. Setup, Users, Questions, Exams and the other admin pages are locked, and **teachers and students can't sign in**. Anyone already signed in can continue until their token expires (up to 8 hours).
- **Fee:** `students × price per student`, never below `MIN_TERM_FEE`. The superadmin can give a school its own price (Schools → expand a school → *Fee per term*).
- **One payment covers 1–3 terms.** Each term adds `TERM_DAYS` of access, stacked on any time still remaining; the superadmin may instead enter an exact *access until* date to match the school's real term end.
- **Cash / transfer (current method):** the school pays the platform owner. The superadmin opens **Schools**, expands the school, and records the amount, a unique reference (e.g. a receipt number), the number of terms and an optional label (e.g. `2026/27 Term 1`). Access is restored immediately.
- **Online (Nomba):** the school admin pays from Billing and a webhook records it. Off until `ONLINE_PAYMENTS_ENABLED=true`.
- There is no undo for a recorded payment; use a new reference for every payment.

## AI questions

1. **Curriculum** page: choose the class and subject, then upload a PDF, Word (.docx) or text file (up to 4 MB) or paste the text. Scanned PDFs (photos of pages) can't be read — paste the text instead. Admins can add for any class; teachers for their own subjects.
2. **AI questions** page (teachers): pick a curriculum and topics, the number of MCQ and theory questions (up to 15 per run) and difficulty.
3. Results are saved as **drafts** and cannot be used in an exam until the teacher approves them. Always review: the AI can make mistakes.

Cost is pay-as-you-go on the Anthropic account behind `ANTHROPIC_API_KEY`. Credits are prepaid and expire after a year.

## Bulk upload

**Users → Bulk upload.** CSV or .xlsx, no row limit (sent to the server in batches of 40).

| Students | Teachers |
|----------|----------|
| `name`, `class` (must match a class in Setup exactly), optional `email` | `name`, `subjects` (separate several with `;`, must match Setup), optional `email` |

Students get a generated username (e.g. `adaeze.okafor`) and sign in with it. After the import, download the login sheet: temporary
passwords are shown only once. Everyone must choose a new password at first sign-in. Re-uploading the same file skips people who
already exist.

## Activity and corrections (admin)

The **Activity** page has a school-wide feed, a People list (last-active time), and an Exam attempts list. Open an attempt to see every
answer against the answer key and any integrity events, then:

- **Reopen** a crashed attempt for extra minutes · **Reset** it so the student starts afresh · **Regrade** it
- **Override** theory marks · **Dismiss** a false integrity termination
- On an exam: **Regrade all** after a teacher fixes a wrong answer key · **Finalize abandoned attempts**

Every correction needs a reason and is recorded. Activity history is kept for about six months.

## API map

Everything is under `/api/v1/<role>/…` (the frontend adds the role prefix automatically):
`/auth` · `/superadmin/schools` · `/admin/{classes,subjects,users,questions,exams,curriculum,activity,review,billing,branding}` ·
`/teacher/{classes,subjects,questions,curriculum,exams,results,grading,branding}` · `/student/{exams,attempts,results,branding}` ·
`/webhooks/nomba`. Teacher and admin routes sit behind the subscription check; billing, login and student routes do not.

## Known limitations / roadmap

- Nomba webhook signature verification needs fixing before online payments can be switched on.
- Exams need an internet connection throughout (true offline exam-taking is deferred).
- Logo upload is not built: a school's logo is set by pasting an image URL, plus a brand colour.
- Abandoned attempts are finalized by an admin button, not automatically.
- No self-service "forgot password": an admin resets it.
- No automated tests yet — use `docs/TESTING.md`.

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
| `CRON_SECRET` | Random string, 16+ characters. Protects the scheduled job (`/api/v1/cron/maintenance`). Without it the job refuses to run |
| `RESEND_API_KEY`, `MAIL_FROM` | Email through Resend (forgot-password, expiry reminders). `MAIL_FROM` must be on a domain verified with Resend. Leave empty to keep email features off |
| `RECEIPT_PREFIX`, `RECEIPT_ISSUER_NAME`, `RECEIPT_ISSUER_CONTACT` | Receipt numbering (default `BMK`) and the name/contact printed on receipts |
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
- **Undo a wrong cash payment:** Schools → expand the school → *Payments* → **Cancel this payment** (reason required). Only the newest cash payment can be cancelled; the school's access date goes back to what it was. The cancelled entry stays in the history, marked *Cancelled*, and its reference/receipt number can be used again for the corrected entry. Online (Nomba) payments are not cancelled here — those need a refund through Nomba.
- **Receipts:** every payment has a numbered receipt (`BMK-2026-00001`, sequential per year). School admins open it from **Billing → Receipt**; the owner from the school's payment list. *Print / save as PDF* uses the browser's print dialog. Payments recorded before receipts existed get a number the first time one is opened.
- **Expiry reminders:** school admins are emailed at 14, 7, 3 and 1 days before access ends and once when it has ended (never the same reminder twice; renewing starts a fresh cycle). Admins also see a banner in the app for the last 14 days. The owner can tick *Only schools whose access ends within 30 days* on the Schools page. Emails need `RESEND_API_KEY` + `MAIL_FROM`; the banner works without them.

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

## Scheduled job

`backend/vercel.json` runs `GET /api/v1/cron/maintenance` once a day at 03:00 UTC (04:00 in Nigeria). It does two things:

1. **Finalizes abandoned attempts** — anything still *in progress* two minutes past its own deadline (student closed the browser, power cut) is marked auto-submitted and scored. The activity feed shows a "System" line per school. Results, grading and the student's own result page also do this for their exam when opened, so nothing waits for the schedule. The admin *Finalize abandoned attempts* button still works.
2. **Sends expiry reminders** (see Billing).

Set `CRON_SECRET` on the backend project (Vercel then sends it automatically as `Authorization: Bearer …`). Vercel's free (Hobby) plan allows daily schedules only; on Pro change the schedule in `vercel.json` (e.g. `*/15 * * * *`). To trigger it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<backend>/api/v1/cron/maintenance`.

## Passwords

- **First sign-in:** accounts created in bulk or reset by an admin have a temporary password. The **server** refuses every request except *change password* until a new one is chosen (the app also redirects).
- **Changing a password signs out every other session** for that account (the current session gets a fresh token). The same happens when an admin resets someone's password.
- **Forgot password:** *Sign in → Forgot password?* emails a single-use link valid for 30 minutes (only a hash of it is stored; asking again cancels the older link). It works for anyone with a real email address on the account — admins, teachers, and students who were given an email. Students created without one (placeholder address) can't receive email: their teacher/admin resets it. The page gives the same answer whether or not the account exists, and requests are rate-limited. Needs `RESEND_API_KEY` + `MAIL_FROM`; without them the page says so.
- Minimum length is 4 characters (`MIN_PASSWORD_LENGTH` in `backend/src/utils/password.ts`) — consider raising it.

## Automated tests

`cd backend && npm test` runs unit tests (Node's built-in runner, no database needed) for the cron check, expiry-reminder scheduling, payment-undo rules, receipt numbers, password-reset helpers, session retirement and the login/forgot-password throttles. Flows that touch the database are still covered by `docs/TESTING.md`.

## API map

Everything is under `/api/v1/<role>/…` (the frontend adds the role prefix automatically):
`/auth` · `/superadmin/schools` · `/admin/{classes,subjects,users,questions,exams,curriculum,activity,review,billing,branding}` ·
`/teacher/{classes,subjects,questions,curriculum,exams,results,grading,branding}` · `/student/{exams,attempts,results,branding}` ·
`/auth/{login,change-password,forgot-password,reset-password}` · `/cron/maintenance` · `/webhooks/nomba`. Teacher and admin routes sit behind the subscription check; billing, login and student routes do not.

## Security

- **Login throttling:** after 5 wrong passwords for an account from one device, that device is locked out of the account for 15 minutes; 20 wrong passwords from anywhere pause the account; 100 failures from one IP block that IP. Counters live in MongoDB so they work across serverless instances.
- **Live account checks:** every request re-checks that the user still exists and the school is active (cached for 30 seconds), so deactivating a school or deleting a user signs people out within about a minute instead of after the 8-hour token life.
- **Headers:** `helmet` sets standard security headers.

## Known limitations / roadmap

- Nomba webhook signature verification needs fixing before online payments can be switched on.
- Exams need an internet connection throughout (true offline exam-taking is deferred).
- Logo upload is not built: a school's logo is set by pasting an image URL, plus a brand colour.
- Students without an email can't use *Forgot password* (their teacher/admin resets it).
- Nomba payments can't be cancelled in-app (refund through Nomba).
- Only unit tests are automated; database and browser flows follow `docs/TESTING.md`.

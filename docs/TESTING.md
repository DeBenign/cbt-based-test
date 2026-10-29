# End-to-end test checklist

Run top to bottom on a **staging database** (or a throwaway school). Use the real frontend + backend.
Tick each box; if a step doesn't give the expected result, note the step number and the exact message.

Prepare three browsers or profiles (or one normal + two private windows): **Owner**, **Admin/Teacher**, **Student**.

## 0. Platform owner

| # | Do | Expect |
|---|----|--------|
| 0.1 | `npm run seed:superadmin`, then sign in as that superadmin | Lands on the Schools page |
| 0.2 | Create a school: name, admin name, admin email, admin password | School appears with a **Trial** badge and "Trial ends" about 90 days away |
| 0.3 | Expand the school | Shows *Fee per term* (0 students, so the minimum fee), and the *Record a payment* form |

## 1. School setup (sign in as the new admin)

| # | Do | Expect |
|---|----|--------|
| 1.1 | Sign in | Home/Setup page. Refresh the page — you stay signed in |
| 1.2 | Setup: add classes `JSS1A`, `JSS2A`; add subjects `Basic Science`, `Mathematics`; link each subject to a class | Items listed |
| 1.3 | Billing page | Free-trial badge, fee card (0 students), "How to pay" shows cash instructions only (no Nomba form) |
| 1.4 | Branding: set a colour | Colour applies across the app |

## 2. Users: single and bulk

| # | Do | Expect |
|---|----|--------|
| 2.1 | Users → Bulk upload → "Students" → **Download template** | A CSV with `name,class` |
| 2.2 | Fill ~5 students (one with a class name that doesn't exist, one duplicate name) and upload | Preview shows rows; import reports created / skipped / needs fixing, with reasons |
| 2.3 | **Download logins (CSV)** | File lists username + temporary password for each created student |
| 2.4 | Upload the same file again | Everyone is skipped as "already in that class" |
| 2.5 | Bulk upload teachers (`name`, `subjects`, `email`) | Teachers created; subjects assigned |
| 2.6 | Search and filter the user list; page through | Search by name/username works; filters by role and class work |
| 2.7 | Add one user manually | Created; appears in the list |

## 3. First sign-in

| # | Do | Expect |
|---|----|--------|
| 3.1 | Sign in as a bulk student with **username** + temporary password | Forced to "Choose your own password" |
| 3.2 | Try to open another page before changing it | Redirected back to the change-password page |
| 3.3 | Enter wrong current password | Error shown; you are **not** signed out |
| 3.4 | Change the password correctly | Continues to the student's exams; next login uses the new password |
| 3.5 | Sign in as a teacher the same way | Same forced change |
| 3.6 | While still on the forced-change page, open the browser's dev tools and call any other API (e.g. `GET /api/v1/student/exams` with the token) | `403` with `PASSWORD_CHANGE_REQUIRED` — enforced by the server, not just the app |
| 3.7 | After the change, use the same tab | Works without signing in again (a fresh token was issued) |
| 3.8 | Sign the same account in on a second browser first, then change the password in the first | The second browser is sent to sign-in with "Your password was changed" within ~30 seconds |
| 3.9 | Admin resets a signed-in teacher's password | The teacher's next click goes to sign-in; signing in with the temporary password forces a change |

## 4. Curriculum and AI questions (needs `ANTHROPIC_API_KEY` and credit)

| # | Do | Expect |
|---|----|--------|
| 4.1 | Curriculum → class + subject → upload a small **PDF**, then a **.docx**, then paste text | Each saves with a topic count; a scanned/empty PDF gives a clear message |
| 4.2 | As the teacher: Curriculum page | Sees only own subjects |
| 4.3 | AI questions → choose curriculum → 5 MCQ + 1 theory → Generate | Drafts appear (can take up to a minute). With no key: "not switched on" message |
| 4.4 | Edit one draft (change an option, change the correct answer) and save | Saved |
| 4.5 | Discard one; approve one; "Approve all" the rest | Approved questions appear in the Question bank; drafts list empties |
| 4.6 | Question bank | Drafts are **not** listed; approved ones are |
| 4.7 | Add one MCQ and one theory question by hand | Saved |

## 5. Exam

| # | Do | Expect |
|---|----|--------|
| 5.1 | Create an exam: class, subject, start in 2 minutes, end in 60, duration 10, lockdown on | Saved as draft |
| 5.2 | Attach questions / auto-fill | Only approved questions can be added |
| 5.3 | Publish | Status becomes scheduled |

## 6. Student takes the exam

| # | Do | Expect |
|---|----|--------|
| 6.1 | Student sees the exam before the start time and tries to start | Refused: not started yet |
| 6.2 | Start after the start time | Fullscreen/lockdown prompt; questions in a shuffled order |
| 6.3 | Answer a few, **refresh the page** | Stays signed in; the same questions and your answers return |
| 6.4 | Switch tab once | An integrity event is recorded (a warning shows) |
| 6.5 | Submit | MCQ score shown/recorded; theory marked "awaiting grading" |
| 6.6 | Second student: start and **close the browser** without submitting | Attempt stays in progress (cleaned up in 9.5) |
| 6.7 | Third student: trigger repeated violations | Attempt is terminated and flagged |

## 7. Grading and results

| # | Do | Expect |
|---|----|--------|
| 7.1 | Teacher → Grading → open the exam | Submitted attempts with theory answers listed |
| 7.2 | Award marks to a theory answer | Score updates; attempt leaves the queue when fully graded |
| 7.3 | Results (teacher, admin, student) | Each sees the right scope; a student sees only their own |

## 8. Activity (admin)

| # | Do | Expect |
|---|----|--------|
| 8.1 | Activity → feed | Logins, question/exam actions, starts/submits, with names and times |
| 8.2 | People → open a student, then a teacher | Student: attempts. Teacher: question counts (hand / AI / drafts), exams |
| 8.3 | Exam attempts → filter flagged | The terminated attempt is listed |

## 9. Admin corrections (each needs a reason)

| # | Do | Expect |
|---|----|--------|
| 9.1 | Open a submitted attempt → **Reopen** 10 min (no reason first) | Refused until a reason is typed; then the student can resume with answers kept |
| 9.2 | Open the flagged attempt → **Dismiss false alarm** | Status becomes submitted; flag events remain |
| 9.3 | Override theory marks | Score changes; entry in the feed shows before/after and the reason |
| 9.4 | Teacher edits an MCQ's answer key → admin **Regrade all** on that exam | Scores change; the feed reports how many |
| 9.5 | **Finalize abandoned attempts** on the exam | The "closed browser" attempt gets a score |
| 9.6 | **Reset** an attempt (exam window still open) | Student can start again |

## 9b. Abandoned attempts (automatic)

Needs `CRON_SECRET` set on the backend. Use a short exam so the deadline passes quickly.

| # | Do | Expect |
|---|----|--------|
| 9b.1 | Student starts an exam, closes the browser; wait until 3+ minutes after their deadline | Attempt still shows *in progress* |
| 9b.2 | Teacher opens that exam's Results (after the 1-hour unlock) or Grading | The attempt is now *auto-submitted* with a score — no button pressed |
| 9b.3 | Repeat 9b.1, then run `curl -H "Authorization: Bearer $CRON_SECRET" <backend>/api/v1/cron/maintenance` | JSON shows `attempts.finalized` ≥ 1; Activity feed has a "System" line "Automatically finalized N abandoned attempt(s)" |
| 9b.4 | Same curl with a wrong or missing secret | `401` (or `503` if `CRON_SECRET` is not set on the server) |
| 9b.5 | Run the curl again | `finalized` is 0 (nothing double-processed) |
| 9b.6 | Vercel → backend project → Settings → Cron Jobs | `/api/v1/cron/maintenance` listed; *Run* it once and check the log |

## 9c. Forgot password (needs email set up: `MAIL_FROM` + SMTP_* or `RESEND_API_KEY`)

First run `cd backend && npm run test:mail -- your-own@email.com` — it checks the login and sends one test email.

| # | Do | Expect |
|---|----|--------|
| 9c.1 | Login page → *Forgot password?* → enter a teacher's email | Same neutral message shown; email arrives within a minute |
| 9c.2 | Enter an email that doesn't exist | Identical message, no email |
| 9c.3 | Enter a bulk-created student's username | Identical message, no email (placeholder address) |
| 9c.4 | Open the link; the address bar no longer shows the code | Form to choose a new password |
| 9c.5 | Save a new password, then sign in with it | Works; a "your password was changed" email arrives; old password refused |
| 9c.6 | Reopen the same link | "invalid or has expired" (single use) |
| 9c.7 | Request two links; use the **older** one | Refused; only the newest works |
| 9c.8 | Request a link, wait 30+ minutes, use it | Refused as expired |
| 9c.9 | Ask for a reset 4 times for the same account within 15 minutes | 4th is refused: "Too many requests" |
| 9c.10 | Signed in on another browser, reset by link | The other browser is signed out |
| 9c.11 | Clear the email settings (or test on a deployment without them) and request a link | Clear message: "isn't switched on yet… ask your school admin" |
| 9c.12 | Deactivated school's teacher requests a link | Neutral message, no email |

## 10. Billing

| # | Do | Expect |
|---|----|--------|
| 10.1 | Owner: expand the school | *Fee per term* shows students × price (or the minimum fee) |
| 10.2 | Owner: set a custom price per student | Fee recalculates; admin's Billing page shows the same figures |
| 10.3 | Force the end of the trial (set `trialEndsAt` to a past date in the database) | Admin pages redirect to Billing with "Access locked"; the text says teachers and students can't sign in |
| 10.4 | Sign in as a teacher or student | Refused: "free trial has ended" |
| 10.5 | Owner: record a payment (amount, receipt number, 1 term, label) | "Access until" about 120 days ahead; Billing shows Active and the payment in history |
| 10.6 | Teacher/student sign in again; admin pages work | No re-login needed for the admin |
| 10.7 | Record another payment with the **same reference** | Refused: reference already exists |
| 10.8 | Record 1 term with an explicit *Access until* date | That exact date is used |
| 10.9 | Expand the school: *Payments* list | Each payment shows a receipt number like `BMK-2026-00001` and a **Receipt** link |
| 10.10 | Open a receipt as the owner, then as the school admin (Billing → Receipt) | Same details; *Print / save as PDF* prints only the receipt |
| 10.11 | As admin, try to open another school's receipt by editing the URL's payment id | "Receipt not found" |
| 10.12 | Record a wrong payment (wrong amount), then **Cancel this payment** with no reason | Refused until a reason is typed |
| 10.13 | Cancel it with a reason | Entry shows *Cancelled* (struck through); "Access until" returns to its earlier value; admin's Billing shows it as Cancelled and the activity feed has a "payment was cancelled" line |
| 10.14 | Re-record the correct payment using the **same receipt/reference** | Accepted this time |
| 10.15 | Record two payments, then try to cancel the **older** one | No cancel button; if forced via the API: "Cancel the more recent payment first (receipt …)" |
| 10.16 | Open the cancelled payment's receipt | Red "CANCELLED" banner |
| 10.17 | Set a school's `trialEndsAt` (or `subscriptionPaidUntil`) to ~5 days ahead; sign in as its admin | Yellow banner: "…ends in 5 days… See how to renew" |
| 10.18 | Owner → Schools | School shows "access ends in 5 days"; ticking *Only schools whose access ends within 30 days* keeps it |
| 10.19 | Run the maintenance curl (9b.3) with email configured | The admin gets one reminder email; `reminders.emailsSent` ≥ 1 |
| 10.20 | Run it again | No second email (`emailsSent` 0) |
| 10.21 | Record a payment (new end date), then repeat 10.17–10.19 close to the new end | A fresh reminder is sent for the new date |

## 11. Security spot checks

| # | Do | Expect |
|---|----|--------|
| 11.1 | A student opens `/teacher/questions` in the address bar | Redirected away |
| 11.2 | Sign in with a wrong password | "Invalid credentials" (not a network error) |
| 11.3 | Stay idle past the token lifetime, then click | Sent to the sign-in page |
| 11.4 | Enter a wrong password 5 times for the same account | The 6th try (even with the right password) is refused: "Too many failed sign-in attempts. Try again in N minutes." A different account still signs in |
| 11.5 | Sign in successfully before the 5th failure | The failure counter resets |
| 11.6 | While a teacher is signed in, the owner deactivates their school | Within about 30 seconds the teacher's next click returns them to the sign-in page with "Your school's account is no longer active" |
| 11.7 | Reactivate the school | The teacher can sign in again |
| 11.8 | Admin deletes a signed-in student's account | The student is signed out within about 30 seconds |

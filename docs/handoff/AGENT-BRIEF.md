# Shared brief for feature agents (read fully before starting)

Project: `D:\my work\ElearningPro` — Egyptian/Arab e-learning platform. Next.js 14 app router,
Prisma 5 + Postgres, NextAuth v5 (JWT; `session.user.{id, role, instructorApproved}`; roles
STUDENT | INSTRUCTOR | ADMIN | PARENT), next-intl (Arabic default RTL, English LTR; cookie `locale`),
shadcn/ui + Tailwind, sonner toasts. Eight other agents are working in the same working tree at
the same time, each on a different feature. Stay inside your own files.

## The data model is final — do not edit it
`prisma/schema.prisma` already contains every model you need (search for your feature's
section: "Video protection", "Access codes", "Exams: question bank", "Parents",
"Organizations", "Group schedule, attendance and monthly fees", "School", "AI",
"Gamification", plus new fields on User, Course, Lesson, Quiz, QuizQuestion, QuizAttempt,
QuizAnswer, ClassGroup). The Prisma client is already generated and the local DB is migrated.
**Never** edit the schema or run `prisma db push / migrate / generate` (the running dev server
locks the engine on Windows). If you truly need a schema change, work around it and say so in
your report.

## Files nobody but the lead edits
`prisma/schema.prisma`, `messages/*.json`, `lib/activity.ts`, `lib/auth.ts`, `middleware.ts`,
`lib/access.ts`, `lib/whatsapp.ts`, `lib/wallet.ts`, `lib/organization.ts`,
`components/instructor/instructor-shell.tsx`, `components/student/student-shell.tsx`,
`components/admin/admin-sidebar.tsx`, `components/layout/navbar.tsx`,
`components/layout/dashboard-shell.tsx`, `app/(main)/student/page.tsx`,
`app/(main)/instructor/page.tsx`, `app/(main)/admin/page.tsx`, `playwright*.ts`,
`tests/qa/global-setup.ts`, `tests/qa/support.ts`, `package.json`.
Navigation entries and dashboard widgets: **do not add them**; list them in your report
(route, label ar/en, lucide icon, which shell) and the lead wires them up.
If you need a new npm package, don't install it — report it.

## Shared helpers you should use
- `lib/db.ts` (`db`), `lib/api-error.ts` (`readJson(request)`, `apiErrorResponse(error)` — call
  in every catch block before logging, like existing routes), `lib/instructor-guard.ts`
  (`requireInstructor()`, `requireAdmin()`, `pendingInstructorResponse(session)`),
  `lib/rate-limit.ts` (`rateLimit`, `getClientIp`, `tooManyRequests`).
- `lib/activity.ts` → `logActivity({actorId, actorRole, action: "<entity>.<verb>", entityType,
  entityId, summary, metadata})` for every meaningful action (admins see everything). Any
  `"<entity>.<verb>"` string is accepted.
- Notifications: `db.notification.create({ data: { userId, type: "SYSTEM" | ..., title, message, link } })`.
- `lib/email.ts` → `sendEmail({to, subject, html})` (throws when unconfigured; wrap in try/catch).
- `lib/whatsapp.ts` → `sendWhatsApp({to, text, template, userId})` (never throws; logs to
  MessageDelivery; `normalizeEgyptianPhone`).
- `lib/wallet.ts` → `creditWallet(...)`, `debitWallet(...)` (atomic, `InsufficientBalanceError`
  with `code = "insufficient_balance"`), accept an optional Prisma tx.
- `lib/organization.ts` → `getOrgMembership`, `hasOrgRole(orgId, user, roles)`,
  `canManageGroup(groupId, user)` (group teacher, org OWNER/MANAGER, or admin), `ORG_MANAGER_ROLES`.
- `lib/access.ts` → `getCourseAccess(user, course)` decides who may open a course.
- Settings: `db.setting` key/value table (string values).

## UI conventions
- Reuse `components/shared/*` (PageHeader, StatCard, SectionCard, EmptyState, StatusBadge,
  AvatarName, ScoreBar, skeletons — see `components/shared/index.ts`) and `components/ui/*`.
  Look at `app/(main)/instructor/subscribers/page.tsx`, `app/(main)/instructor/results/page.tsx`,
  `app/(main)/student/subscriptions/page.tsx`, `app/(main)/admin/activity/page.tsx` for the
  current modern style, and match it. Pages under `/student`, `/instructor`, `/admin` are inside
  their dashboard shells automatically (layouts exist).
- RTL + LTR with logical classes only (`ms-/me-/ps-/pe-/start-/end-`, never `ml-/mr-/left-/right-`
  for layout), dark mode, no horizontal scroll at 390px width. Numbers/dates via the locale.
- Every user-facing string translated. **Do not edit `messages/*.json`.** Put all new keys in
  `C:/Users/hp/AppData/Local/Temp/claude/d--my-work-ElearningPro/ad7806c2-506d-4dd3-acdf-0ea31ec90696/scratchpad/keys/keys-<your-feature>.json`
  as `{ "ar": { "<namespace>": {...} }, "en": { "<namespace>": {...} } }` with identical key
  sets; use only your own namespace(s) (listed in your task) plus existing keys. Also add
  labels for your activity actions under `adminActivity.actions.<entity>.<verb>` in that file.
  Natural Arabic (Egyptian-friendly MSA). ICU plurals where counts appear.
  Because keys are merged later, the running app shows raw keys for your new strings until the
  lead merges them — that's expected; don't "fix" it.

## Tests
- Write a Playwright API/UI spec `tests/qa/<NN>-<feature>.spec.ts` (number given in your task)
  using `tests/qa/support.ts` helpers: `apiAs("admin"|"student"|"ahmed"|"sara")` (ahmed is an
  approved instructor who owns seeded courses; sara is another instructor),
  `registerUser("STUDENT"|"INSTRUCTOR")` (returns `{email, password, api}`), `approveInstructor(email)`,
  `anon()`, `db()` (Prisma client on the test DB), `fixtures()`, `uniqueEmail()`.
  Look at `tests/qa/11-instructor-application.spec.ts` for the style (serial, numbered ids).
  Name test data so it's recognizable (titles starting with `QA `, emails from `uniqueEmail`).
- A dev server is **already running** on http://localhost:3010 against the local test DB
  (emails and WhatsApp only logged). Run only your spec with:
  `npx playwright test -c playwright.agent.config.ts tests/qa/<NN>-<feature>.spec.ts --reporter=line`
  Never start/stop/restart the dev server, never use `playwright.qa.config.ts` or run the whole
  suite (its global setup deletes test users that other agents are using). If the server
  returns errors from files you don't own, it's another agent mid-edit — wait/retry, don't fix.
  For pages, a UI smoke check (page loads, no `pageerror`) is enough; focus on API behavior,
  permissions (other teachers/students must be refused), validation and edge cases.
- Type-check with `npx tsc --noEmit -p .` (slow: use a 10-minute timeout). Other agents' files
  may have transient errors — fix only errors in your files. Lint: `npx next lint --dir <your dirs>`.

## Windows notes
Use the Write/Edit tools for files (bash heredocs break on apostrophes). Files may be CRLF.

## Final report (keep it concise)
1. Files created/changed. 2. Routes/pages and the nav entries + dashboard widgets you want the
lead to add (shell, route, ar/en label, icon). 3. Env vars needed in production and behavior
without them. 4. Activity actions logged. 5. Test result (passed/failed counts). 6. Gaps,
and anything the lead must integrate in shared files (exact snippet + file + where).
Do not commit.

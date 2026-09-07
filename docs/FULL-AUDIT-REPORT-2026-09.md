# ElearningPro — Full Audit Report (Translation / Design / Functionality & Security)

> **Date:** 2026-09-07
> **Scope:** Independent re-verification of the whole codebase against the claims in `docs/TEST-PLAN.md`, `docs/DESIGN-IMPROVEMENTS.md`, `docs/FINAL-QUALITY-REPORT.md`, `docs/RTL-STATUS-REPORT.md`. Conducted via 3 parallel deep-dive passes: i18n/RTL, design/UI, functionality/security.
> **Headline:** The prior docs are broadly accurate about what they explicitly tested, but all four **overstate completeness** in areas they didn't fully verify (translation coverage outside labels, dark mode on admin/instructor surfaces, mobile nav on dashboards, concurrent-request races). This report lists what's genuinely new, regressed, or previously uncovered.

---

## Priority 0 — Fix immediately (money-losing / broken-feature / security)

| # | Issue | File(s) | Impact |
|---|---|---|---|
| 1 | **Stripe webhook idempotency race** — duplicate/concurrent webhook delivery can double-create Purchase+Enrollment+instructor earnings, because the idempotency check runs *before* the transaction and `Purchase.providerId` has no DB unique constraint (only indexed). | `app/api/webhooks/stripe/route.ts:74-80`, `prisma/schema.prisma:522,538` | Double-paid enrollments, inflated instructor earnings |
| 2 | **Admin withdrawal approval isn't atomic** — concurrent PATCH calls (double-click / 2 admin tabs) can both pass the status check and both increment instructor earnings. The instructor-side route already guards this atomically; the admin-side one doesn't. | `app/api/admin/withdrawals/[withdrawalId]/route.ts:28-65` | Instructor gets paid twice for one withdrawal |
| 3 | **Fake payment "success" for PayPal/Paymob/Tap** — the stub handler returns `{status: 501}` as a JSON *body field* instead of the HTTP status (still 200 OK). The client treats any 200 with no `redirectUrl` as a completed payment and shows "Payment successful," routing the user to `/learn` with **no Purchase/Enrollment ever created**. | `app/api/payments/create/route.ts:217-251`, `components/checkout/checkout-form.tsx:107-120` | Students think they paid and didn't get access; confusing false-positive |
| 4 | **File uploads are written to local disk**, which is incompatible with the app's own Vercel serverless deployment (read-only FS outside ephemeral `/tmp`). Thumbnails/avatars/attachments will fail or vanish in production. | `app/api/upload/route.ts:66-125` | Course thumbnails, avatars, attachments broken in production |
| 5 | **Admin dashboard approve/reject buttons for pending courses/instructors have no `onClick` handler** — purely decorative, look functional but do nothing. | `app/(main)/admin/page.tsx:238-256,304-317` | Admin thinks they approved/rejected something; nothing happened |
| 6 | **Admin/instructor dashboards have zero mobile navigation** — sidebar is `hidden lg:flex` with no hamburger/drawer fallback anywhere. Below 1024px, an admin/instructor cannot navigate sections except by typing URLs. | `components/admin/admin-sidebar.tsx:101`, `components/instructor/instructor-shell.tsx:49` | Dashboards unusable on phones/tablets, despite docs claiming "100% responsive" |
| 7 | **`formatPrice()`/`formatDuration()` are hardcoded to Arabic (`ar-EG`) regardless of app locale** — every price/duration on the site (course cards, sidebars, instructor pages, wishlist, purchases) shows Arabic-Indic digits and Arabic units even when the UI is switched to English. | `lib/utils.ts:17-35` (8+ call sites) | English-locale users see Arabic numerals/units everywhere prices appear |
| 8 | **Core user-facing flows have zero translation wiring**: entire login/register/forgot-password/reset-password error & toast text, and the entire quiz-taking UI (`quiz-client.tsx` has no `useTranslations` import at all), and the subscription/pricing checkout page. | `app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `components/quiz/quiz-client.tsx`, `app/(main)/checkout/subscription/page.tsx` | English users hit Arabic-only errors during signup/login/quiz/payment — the most critical user journeys |

---

## Priority 1 — High (real bugs, fix soon)

**Translation**
- Server-rendered admin/instructor/student dashboard pages hardcode `toLocaleDateString("ar-EG")` and the literal currency string `"ج.م"` in ~19 places instead of calling `getLocale()` / `formatPrice()`. Examples: `app/(main)/admin/page.tsx:366`, `app/(main)/instructor/page.tsx:189,193,312,365`, `app/(main)/instructor/analytics/page.tsx:89`, `components/checkout/checkout-form.tsx:230,299,306,313,323`.
- Settings forms (`components/settings/profile-form.tsx`, `password-form.tsx`, `notification-settings.tsx`), `components/instructor/create-course-form.tsx`, and `app/(main)/contact/page.tsx` have **no i18n wiring at all** — every label/toast/validation message is hardcoded Arabic.
- All 5 route `loading.tsx` files are byte-for-byte identical, hardcoded Arabic `"جاري التحميل..."`, no `useTranslations`.

**Design / Accessibility**
- All 12 files in `components/admin/*` have zero `dark:` classes; several hardcode light-pastel status badges (`bg-green-100 text-green-800` etc.) with no dark variant — these render as bright boxes on the dark page in dark mode. Files: `courses-table.tsx:156,163`, `withdrawals-table.tsx:125,132,138`, `components/instructor/withdrawal-history.tsx:45,51,59`, `payments-table.tsx:96,98`.
- No shared `Skeleton` or `EmptyState` component exists despite `globals.css` already defining unused `.skeleton`/`shimmer` utilities, and despite `DESIGN-IMPROVEMENTS.md` explicitly recommending both be built.
- 50 icon-only buttons (`size="icon"`) across the app have **zero `aria-label`/`sr-only` text** — e.g. navbar language/search/hamburger toggles, admin approve/reject icons, table dropdown triggers. The adjacent theme-toggle button does this correctly, so the pattern is known but not applied.
- RTL bug baked into shared primitives used everywhere: `components/ui/dialog.tsx:58` and `alert-dialog.tsx:54` hardcode `sm:text-left` (should be `sm:text-start`) — every dialog title left-aligns even in Arabic. `components/ui/table.tsx:76` hardcodes `text-left` on `TableHead` — every admin table header left-aligns in RTL despite a global `[dir="rtl"]` rule that this class overrides.
- `components/layout/navbar.tsx:200` — `signOut()` hardcodes the production URL (`https://elearning-pro-pearl.vercel.app/`) as the callback. Logging out from localhost/staging bounces the user to the live production site.

**Functionality / Security**
- `app/api/messages/students/route.ts:18-26` compares `Course.instructorId` (a `User.id`) against `InstructorProfile.id` (a different cuid) — **every instructor's "my students" contact list is always empty**, a functional dead feature.
- Login (`lib/auth.ts` Credentials provider) has **zero rate limiting** — password brute-forcing is fully open at the application layer, unlike register/forgot-password/quiz/certificate-verify which are all throttled.

---

## Priority 2 — Medium

- shadcn primitives (`dropdown-menu.tsx:96,120`, `select.tsx:105,118`) reserve icon padding with hardcoded `pl-8 pr-2` while their own check/radio indicator uses logical `start-2` — text and indicator misalign in Arabic dropdowns/selects used across every admin table filter.
- `pagination.tsx:69,85` hardcodes English "Previous"/"Next" and non-mirrored chevron icons, plus physical `pl-`/`pr-` padding.
- `app/api/set-locale/route.ts` is dead code (the real language switcher in `navbar.tsx` doesn't call it) and buggy anyway (always redirects to `/`, losing the current path) — either wire it up or delete it.
- Certificate numbers are generated by **two different, inconsistent, non-cryptographic** formats in two code paths (`app/api/certificates/[courseId]/route.ts:192-197` vs `app/api/quiz/submit/route.ts:241-244`) — consolidate on one `crypto.randomUUID()`-based generator.
- Forgot-password returns a different response message (and takes measurably longer) for existing vs. non-existing emails — leaks account existence, contradicting the doc's own "same response for both" requirement.
- Admin coupon PATCH doesn't whitelist `discountType` the way the POST route does — a bad request can silently corrupt discount calculation.
- `zod` (a listed dependency, meant for validation) is used in only 1 of 58 API route files; the rest hand-roll `if (!field)` checks, which is how several historical field-name bugs happened.
- Status badges across admin tables use raw hardcoded pastel classes instead of the app's own dark-mode-safe `Badge` variants that already exist for this purpose.
- Non-responsive `grid-cols-2/3` with no breakpoint fallback in several dialogs/forms (quiz editor, withdrawal dialog, live-class scheduler, checkout payment-method tiles) cramp fields on narrow phones.
- Two places use native unstyled `confirm()` instead of the app's themed `AlertDialog` (breaks dark mode/RTL): `components/learn/course-video-player.tsx:131`, `components/live/live-room.tsx:70`.
- No nested `error.tsx` per dashboard section — any thrown error inside `/admin`, `/instructor`, or `/student` drops the user on the generic root error page, losing all dashboard chrome.
- `course-header.tsx:167-173` hardcodes a language-name ternary (Arabic/English/mixed) instead of reusing the existing `common.arabic`/`common.english` translation keys.

---

## Priority 3 — Low (cleanup, not user-visible bugs today)

- `LiveSession`/`LiveSessionAttendee` schema models are 100% dead code (zero references anywhere) — safe to drop in a future migration; only `LiveClass`/`LiveClassAttendee` are actually used.
- No ESLint config file exists (`.eslintrc.json`/`.js`/`eslint.config.js` all absent) despite `npm run lint` and `eslint-config-next` being present — `next lint` will prompt interactively or fail in CI.
- ~26 files use a `t("key") || "hardcoded Arabic fallback"` pattern — all checked keys currently exist, so it's dead code today, but it would silently mask a future missing translation key instead of surfacing it.
- `components/courses/course-detail/course-sidebar.tsx:217` has the last remaining `ml-2` in the codebase (sibling icon on the same line correctly uses `ms-2`).
- `docs/RTL-STATUS-REPORT.md`'s "still needs fixing" file list is stale — the RTL fix script has since been run on all the files it names; only isolated leftovers remain (see above).
- Certificate-verify rate limit is configured at 10 req/min, while the test-plan doc describes 5/min — confirm which is intentional.
- Upload DELETE endpoint has no ownership check (any authenticated user can delete any file if they know its UUID-based name) — low likelihood, but no defense-in-depth.
- `LiveClass.courseId` is nullable and the join route skips all enrollment checks when null — any authenticated user can join a course-less live class. May be intentional (open webinar) but isn't documented as such.

---

## What's confirmed still solid (no action needed)

- Stripe webhook signature verification, coupon field validation (`expiryDate`/`minPurchase`/`maxUses`), Socket.IO JWT-based auth, quiz server-side grading, certificate issuance enrollment/completion checks, category-delete cascade handling, review one-per-user + rating aggregate, DOMPurify sanitization on both `dangerouslySetInnerHTML` sites, real image-byte validation on upload (not just MIME), and `next.config.js` build-error suppression are all still in place as the test plan claims.
- `messages/ar.json` and `messages/en.json` have **100% key parity** (1359/1359 keys both ways, 0 missing) — the translation *file* itself is complete; the gap is entirely in code paths that never call into it (see P0/P1 above).
- `tsc --noEmit` currently reports **0 errors** (better than the doc's claimed ~30 pre-existing errors — this seems to have been fixed since).
- The denormalized-counter drift issue (BUG-031) has a genuine periodic-reconciliation fix (`lib/reconcile-counters.ts` + Vercel cron), though it's still a workaround (up to 24h drift window) rather than write-path prevention.

---

## Suggested fix order

1. **P0 items 1–5** (webhook race, withdrawal race, fake payment success, broken uploads, dead admin buttons) — these are silent data-integrity and money bugs; fix before any more real users hit them.
2. **P0 items 6–8** (mobile dashboard nav, price/duration locale bug, auth/quiz/checkout translation gaps) — these are visible, immediate UX breakage for a large fraction of real sessions (any English-locale user, any mobile admin/instructor).
3. **P1 items** — one sprint.
4. **P2/P3** — backlog, roughly in the order listed.

Happy to start implementing fixes for any specific item(s) above — say which number(s) and I'll go do it.

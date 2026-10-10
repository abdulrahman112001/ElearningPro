# HANDOFF — حالة الشغل على منصة ElearningPro

آخر تحديث: 2026-10-09. الملف ده لأي حد (أو أي جلسة Claude جديدة) هيكمّل الشغل.

---

## 1. الهدف

نحوّل المنصة من موقع كورسات إلى **نظام تشغيل كامل للتعليم**. نفس النظام يخدم:

- المدرس المستقل.
- السنتر والمجموعات، الأونلاين والحضورية.
- المدرسة.

الميزات اللي اتفقنا عليها:

1. حماية الفيديو.
2. أكواد الشحن والمحفظة، والدفع المحلي بفودافون كاش وإنستاباي.
3. امتحانات متقدمة.
4. أولياء الأمور وتقارير واتساب.
5. المؤسسات (سناتر ومدارس).
6. الحضور بـ QR والمصاريف الشهرية.
7. الواجبات وكشف الدرجات ووضع المدرسة.
8. الذكاء الاصطناعي (Claude).
9. النقاط والشارات، وتطبيق موبايل (PWA).

---

## 2. اللي اتعمل واترفع على الموقع (Vercel + Neon)

| Commit | المحتوى |
|---|---|
| `8e4fc1a` | اشتراك شهري في المعلم، الصفوف الدراسية، مجموعات المعلم، أسئلة الدروس، نتائج وترتيب الطلاب، تنبيهات وإيميل لولي الأمر، سجل نشاط الأدمن، قراءة الأدمن لكل المحادثات، إعادة تصميم اللوحات |
| `5406df7` | إصلاح خطأ 500 في صفحة الكورس: استبدال `isomorphic-dompurify` (اللي بيستخدم jsdom) بـ `sanitize-html@2.13.1` |
| `0766dcb` | توحيد شكل النافبار مع السايدبار |
| `e0f44a4` | فورم طلب انضمام المعلم، وموافقة أو رفض الأدمن (لوحة المعلم مقفولة لحد الموافقة) |

- الموقع: https://elearning-pro-pearl.vercel.app
- كل الـ commits دي اترفعت على `main`، وقاعدة Neon متحدّثة لحد `e0f44a4`.
- آخر تشغيل كامل للاختبارات قبل الرفع: QA 265/265، unit 37/37، e2e 69/70. الاختبار اللي فشل في e2e كان timeout بسبب ضغط السيرفر، ونجح لما اتشغّل لوحده.

---

## 3. اللي اتعمل ولسه **ما اترفعش**

### أ) commit محلي `077e06a`: أساس الميزات التسعة (ما اتعملوش push)

- **`prisma/schema.prisma`:** قاعدة البيانات الكاملة لكل الميزات.
  - موديلات جديدة: LessonView, UserDevice, AccessCodeBatch, AccessCode, WalletTransaction, ManualPayment, QuestionBankItem, ParentLink, MessageDelivery, Organization, OrganizationMember, OrganizationInvite, GroupScheduleSlot, GroupSession, AttendanceRecord, GroupFee, AcademicTerm, ClassSubject, TimetableEntry, Assignment, AssignmentSubmission, GradeEntry, Announcement, AiUsage, AiTutorMessage, PointTransaction, Badge, UserBadge.
  - إضافات على User و Course و Lesson و Quiz و QuizQuestion و QuizAttempt و QuizAnswer و ClassGroup.
  - قيم جديدة: `UserRole.PARENT`، و`PaymentProvider.WALLET` و`CODE`، و`QuestionType.ESSAY`.
- **مكتبات مشتركة:**
  - `lib/whatsapp.ts`: يبعت واتساب ويسجّل كل رسالة في MessageDelivery.
  - `lib/wallet.ts`: خصم وإضافة رصيد آمنين.
  - `lib/organization.ts`: صلاحيات المؤسسات.
- **ملفات اتعدّلت:**
  - `lib/activity.ts`: بقى يقبل أي اسم إجراء بصيغة `"x.y"`.
  - `middleware.ts`: بيحمي مسارات `/parent` و`/org`.
- **ملفات تانية:**
  - `playwright.agent.config.ts`: يشغّل spec واحد على سيرفر شغال من غير ما يمسح بيانات الاختبار.
  - `components/ai/generate-questions-dialog.tsx`: اتعمل كملف مؤقت، وبعدين الـ agent بتاع الذكاء الاصطناعي كتب الكود الحقيقي.
- **مكتبات npm جديدة:** `qrcode`, `@types/qrcode`, `@anthropic-ai/sdk`.

### ب) شغل الـ 9 agents: موجود على الجهاز ومش متعمله commit

الـ 9 agents اشتغلوا في نفس الوقت، كل واحد على ميزة. **كلهم وقفوا في النص بسبب حد الاستخدام (rate limit 429)**. الكود اللي كتبوه موجود على الجهاز، ونتيجة `git status`: 29 ملف معدّل وحوالي 260 ملف جديد.

| # | الميزة | آخر حالة معروفة | الـ spec |
|---|---|---|---|
| 1 | حماية الفيديو | API التشغيل، العلامة المائية المتحركة، حد المشاهدات والأجهزة، صفحات المعلم والطالب والأدمن مكتوبة. **فيه 4 أخطاء TypeScript في الـ spec بتاعه** (شوف قسم 5) | `tests/qa/20-video-protection.spec.ts` |
| 2 | الأكواد والمحفظة | الأكواد والاسترداد والمحفظة والتحويلات ومراجعة الأدمن والدفع من المحفظة مكتوبين. وقف وهو بيكتب صفحة تفاصيل الدفعة وطباعة الكروت (الملفات موجودة، لازم تتراجع) | `21-codes-wallet` |
| 3 | الامتحانات | المواعيد، حد المحاولات، أسئلة عشوائية، أسئلة مقالية، صور، كشف الخروج من الصفحة، صندوق التصحيح، بنك الأسئلة. وقف وهو بيعيد فحص tsc | `22-exams` |
| 4 | أولياء الأمور | التسجيل كولي أمر، الربط بكود، لوحة ولي الأمر، التقرير الأسبوعي، cron في `vercel.json`، صفحة `/admin/messaging`. وقف لأن السيرفر كان بيرجّع 500 في `/api/auth/session` | `23-parents` |
| 5 | المؤسسات | الإنشاء، الأعضاء، الدعوات، الفصول، الكورسات، الإعدادات، الصفحة العامة `/o/[slug]`، موافقة الأدمن. وقف لأن السيرفر ما كانش بيرد | `24-organizations` |
| 6 | الحضور والمصاريف | المواعيد، الحصص، QR، قفل الحصة وإبلاغ ولي الأمر، المصاريف والإيصالات والدفع من المحفظة. وقف وهو مستني نتيجة الاختبار | `25-attendance-fees` |
| 7 | المدرسة والواجبات | **اختبارات الـ API نجحت**. الصفحات اتكتبت، ووقف وهو بيعيد tsc والـ spec كامل | `26-school` |
| 8 | الذكاء الاصطناعي | توليد الأسئلة، المساعد الذكي في الكورس، تشخيص الطالب الضعيف، تعديل نص الدرس، صفحة `/admin/ai`. ما بعتش تقرير نهائي | `27-ai` |
| 9 | النقاط والـ PWA | `lib/gamification.ts`، الإنجازات، الترتيب، manifest، أيقونات، service worker، صفحة offline. ما بعتش تقرير نهائي | `28-gamification` |

> ما فيش ولا agent بعت تقريره النهائي. يعني ما فيش ميزة متأكدين إنها مكتملة ونجحت في اختباراتها، ولازم مراجعة كل واحدة.

### ج) ملفات مهمة متحفوظة في المشروع (`docs/handoff/`)

- **`docs/handoff/keys/keys-*.json`:** ترجمات الـ 9 ميزات (عربي وإنجليزي)، **لسه ما اتدمجتش** في `messages/*.json`.
  - عدد المفاتيح: ai 117، attendance 268، exams 151، gamification 96، organizations 251، parent 181، school 342، video 94، wallet 221. العربي والإنجليزي متطابقين في كل ملف.
- **`docs/handoff/merge.js`:** سكربت الدمج. بيحافظ على القيم الموجودة لو فيه تعارض، وبيتأكد إن العربي والإنجليزي متطابقين.
- **`docs/handoff/audit.js`:** بيدوّر على مفاتيح ترجمة ناقصة وروابط مكسورة.
- **`docs/handoff/AGENT-BRIEF.md`:** القواعد اللي الـ agents ماشيين عليها (مين يعدّل أنهي ملف، الترجمات، الاختبارات).
- **`docs/PLATFORM-TEST-CASES.md`:** حالات اختبار مكتوبة بالعربي.

---

## 4. اللي فاضل (بالترتيب)

1. **تكملة الـ 9 ميزات.** لو الجلسة لسه فيها الـ agents، ابعت لكل واحد يكمّل. لو مش موجودين، كمّل كل ميزة بنفسك حسب جدول قسم 3-ب و`docs/handoff/AGENT-BRIEF.md`.
2. **دمج الترجمات:**
   ```bash
   node docs/handoff/merge.js "D:/my work/ElearningPro" docs/handoff/keys/keys-*.json
   node docs/handoff/audit.js "D:/my work/ElearningPro"   # لازم MISSING KEYS = 4 بس (static-page الديناميكية)
   ```
3. **ربط الميزات بالأجزاء المشتركة** (ممنوعة على الـ agents، فلازم تتعمل يدوي):
   - إضافة الصفحات الجديدة في القوائم:
     - `components/student/student-shell.tsx`
     - `components/instructor/instructor-shell.tsx`
     - `components/admin/admin-sidebar.tsx`
   - الصفحات الجديدة:
     - **الطالب:** wallet, devices, family, attendance, homework, timetable, grades, announcements, achievements, leaderboard, organizations.
     - **المعلم:** codes, grading, question-bank, video-protection, attendance, assignments, gradebook, timetable, leaderboard, ai-insights.
     - **الأدمن:** codes, manual-payments, messaging, organizations, security, ai.
     - **عامة:** `/org` و`/parent`.
   - النافبار: لينك اللوحة لدور PARENT يروح لـ `/parent`، ولينك "مؤسساتي" يروح لـ `/org`.
   - إضافة `<CourseTutor courseId lessonId />` (من `components/ai/course-tutor.tsx`) في صفحة الدرس `app/(main)/courses/[slug]/learn/[[...lessonId]]/page.tsx`.
   - إضافة `<LessonTranscriptField lessonId initialValue />` في `components/instructor/lesson-editor.tsx`.
   - استدعاء `onQuizSubmitted(userId, attemptId, scorePercent, passed)` من `lib/gamification.ts` في `app/api/quiz/submit/route.ts` وبعد التصحيح اليدوي في `app/api/instructor/grading/[attemptId]/route.ts`، واستدعاء `onAssignmentSubmitted(...)` في `app/api/assignments/[id]/submission/route.ts`.
   - كروت جديدة في لوحات الطالب والمعلم والأدمن الرئيسية: رصيد المحفظة، الواجبات القريبة، حصص النهارده، النقاط والأيام المتتالية، المصاريف المتأخرة، والتحويلات اللي مستنية مراجعة.
   - فئات جديدة في فلتر سجل النشاط: `components/admin/activity-meta.ts` (`ACTIVITY_CATEGORIES`) لـ video, code, payment, exam, parent, organization, attendance, fee, homework, gradebook.
   - (اختياري) نطاق فرعي لكل مؤسسة (`<slug>.domain` → `/o/<slug>`) في `middleware.ts`.
4. **الاختبارات:**
   - صلّح الـ spec رقم 20 (قسم 5).
   - شغّل `npx tsc --noEmit -p .` و`npx next lint`.
   - شغّل الـ specs 20 لـ 28 واحد واحد بالـ agent config.
   - بعد كده شغّل كل الاختبارات: `npx playwright test -c playwright.qa.config.ts`، والـ unit، والـ e2e.
   - كمان شغّل `npx next build`، عشان أي مكتبة ESM ممكن تكسر الـ build زي ما حصل مع sanitize-html.
5. **مراجعة التصميم:** صور لكل الصفحات الجديدة (فاتح، داكن، موبايل 390px)، والتأكد إن مفيش scroll أفقي.
6. **الرفع:**
   - commit الشغل (ويفضّل commit لكل ميزة).
   - `npx prisma db push` على Neon. هيظهر تحذير data-loss بسبب الـ unique على `User.parentLinkCode`، وهو عمود جديد فاضي فما فيش خطر حقيقي. لازم موافقة صاحب المشروع.
   - `git push origin main`، وبعدها اتأكد إن Vercel رفع بنجاح وإن الصفحات شغالة.
7. **متغيرات البيئة في Vercel** (من غيرها الميزة بتشتغل بشكل محدود):
   - `ANTHROPIC_API_KEY`، واختياري `AI_MODEL`. من غيرهم ميزات الذكاء الاصطناعي بترجع 503 وبيظهر "غير مفعّل".
   - `WHATSAPP_TOKEN` و`WHATSAPP_PHONE_ID` (WhatsApp Cloud API). من غيرهم الرسائل بتتسجل في MessageDelivery بحالة LOGGED بس.
   - `CRON_SECRET` للتقرير الأسبوعي. من غيره `/api/cron/weekly-reports` بيرجع 503.
   - `EMAIL_FROM` مع دومين متوثّق في Resend، ومفاتيح Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
8. **بعد الرفع:** إضافة الصفوف الدراسية من `/admin/grade-levels`، وأرقام استلام فودافون كاش وإنستاباي من صفحة إعدادات الدفع عند الأدمن.

---

## 5. مشاكل لسه مفتوحة

| المشكلة | التفاصيل |
|---|---|
| أخطاء TypeScript | 4 أخطاء في `tests/qa/20-video-protection.spec.ts` (السطور 85 و102 لـ 104): بيعمل `chapters` و`lessons` داخل `db().course.create` بشكل غلط (`isPublished` على الـ chapter، أو `include` ناقص). باقي المشروع ما فيهوش أخطاء |
| سيرفر التطوير المحلي | آخر حاجة اتشافت إن `/api/auth/session` كان بيرجّع 500 أو timeout على port 3010. غالبًا بسبب compile نص مكتمل من agent وقت ما كان بيعدّل. **اقفل السيرفر وشغّله من الأول** (الأمر في قسم 6) |
| الشغل مش متراجع | ما فيش ولا agent سلّم تقريره النهائي، فلازم مراجعة الكود والاختبارات لكل ميزة قبل الرفع |
| ملفات اتعدّلت مشتركة بين ميزات | `app/(main)/courses/[slug]/learn/...` (الفيديو)، `components/instructor/lesson-editor.tsx` و`course-editor.tsx` (الفيديو)، `quiz-editor.tsx` وملفات `api/quiz/*` (الامتحانات)، `course-sidebar.tsx` و`subscribe-button.tsx` (المحفظة)، `progress/lesson` و`certificates` و`app/layout.tsx` (النقاط والـ PWA)، `register` و`login` (أولياء الأمور)، `instructor/groups/[groupId]` (الحضور). لازم تتراجع، لأن كل ملف منهم اتعدّل من agent مختلف |
| رفع الملفات | Vercel ما بيحفظش الملفات المرفوعة (`/api/upload` بيكتب على القرص). عشان كده كل الميزات بتستخدم روابط بدل رفع ملفات. للتطوير بعدين: Vercel Blob أو Neon Object Storage |
| الدفع | Stripe محتاج مفاتيح حقيقية. فوري وPaymob مش متوصّلين، والدفع المحلي معمول عن طريق تحويل يدوي يراجعه الأدمن |
| أمان | فيه Neon API key محفوظ نص صريح في إعدادات الـ MCP (id 3410832). يفضّل تلغيه لو مش محتاجه: `neon api-keys revoke 3410832` |

---

## 6. التشغيل محليًا للاختبار

قاعدة بيانات الاختبار المحلية (embedded Postgres) موجودة في مجلد مؤقت. رابطها:
`postgresql://postgres:postgres@localhost:54329/elearning_test`. لو مش شغالة، استخدم أي Postgres محلي واعمل `prisma db push` و`npm run seed`.

```bash
# تحديث قاعدة الاختبار المحلية بالـ schema (مش Neon!)
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/elearning_test" DIRECT_URL="$DATABASE_URL" npx prisma db push

# تشغيل سيرفر تجريبي على قاعدة الاختبار (الإيميل والواتساب بيتسجلوا بس)
DATABASE_URL=... DIRECT_URL=... NEXTAUTH_URL=http://localhost:3010 NEXT_PUBLIC_APP_URL=http://localhost:3010 \
TRUST_PROXY=true EMAIL_TRANSPORT=log WHATSAPP_TRANSPORT=log STRIPE_SECRET_KEY=sk_test_dummy_qa \
STRIPE_WEBHOOK_SECRET=whsec_dummy_qa npx next dev -p 3010

# spec واحد على السيرفر الشغال
npx playwright test -c playwright.agent.config.ts tests/qa/26-school.spec.ts --reporter=line
# كل اختبارات QA (بيمسح بيانات اختبار @qa.test الأول)
npx playwright test -c playwright.qa.config.ts
```

> ملف `.env` فيه رابط قاعدة **Neon (الإنتاج)**. أي `prisma db push` من غير ما تحدد `DATABASE_URL` بنفسك هيتنفذ على الإنتاج.

---

## 7. تقارير الـ agents النهائية (بتتحدّث أول بأول)

### ✅ النقاط والـ PWA (spec 28: نجح 9/9، وtsc وlint نضاف)
- **روابط في القوائم:**
  - الطالب: `/student/achievements` (إنجازاتي، أيقونة `Trophy`)، و`/student/leaderboard` (لوحة الصدارة، أيقونة `Medal`). مفاتيح الترجمة: `gamification.navAchievements` و`gamification.navLeaderboard`.
  - المعلم: `/instructor/leaderboard` (ترتيب الطلاب بالنقاط، أيقونة `Trophy`).
- **كروت مقترحة في لوحة الطالب:**
  - كارت النقاط والمستوى بـ `LevelRing`.
  - كارت الأيام المتتالية.
  - آخر 3 شارات.
  - ترتيبه في مجموعته الأسبوع ده.
  - البيانات من `/api/gamification/me` و`/api/gamification/leaderboard?scope=group&id=`.
- **كارت مقترح في لوحة المعلم:** أعلى 3 طلاب الأسبوع ده بـ `Podium` من `components/gamification/leaderboard-view.tsx`.
- **زرار تثبيت التطبيق:** `<InstallButton />` من `components/pwa/install-button.tsx`، يتحط في قائمة المستخدم أو لوحة الطالب.
- **ربط مطلوب في `app/api/quiz/submit/route.ts`** بعد حفظ المحاولة:
  ```ts
  import { onQuizSubmitted, onLessonCompleted } from "@/lib/gamification"
  const gamification = await onQuizSubmitted(session.user.id, attempt.id, score, passed)
  if (passed) await onLessonCompleted(session.user.id, quiz.lessonId) // لو المسار ده بيعلّم الدرس إنه خلص
  // رجّع gamification في الـ JSON
  ```
  نفس استدعاء `onQuizSubmitted(attempt.userId, attempt.id, finalScore, passed)` لازم يتعمل كمان بعد التصحيح اليدوي في `app/api/instructor/grading/[attemptId]/route.ts`.
- **ربط مطلوب في الواجبات:** `await onAssignmentSubmitted(session.user.id, assignment.id)` بعد إنشاء AssignmentSubmission.
- **إشعار النقاط:** `useGamificationToast()` من `components/gamification/points-toast.tsx`، وبيتمرر له `data.gamification` في الدرس والامتحان والواجب.
- **ملاحظات:**
  - نقاط الامتحان بتتحسب مرة واحدة بس لكل امتحان مهما الطالب أعاده.
  - الـ service worker بيشتغل في نسخة الـ production بس.
  - مسار `progress/lesson` بقى يرجع بدري لو مفيش اشتراك في الكورس، بدل ما كان بيرجّع 500 لصاحب الكورس أو الأدمن.

### 🔧 تقدّم شغل الربط (Lead)
- ✅ الصفحات الجديدة كلها اتضافت في قوائم الطالب والمعلم والأدمن (`student-shell.tsx`, `instructor-shell.tsx`, `admin-sidebar.tsx`)، وترجمات القوائم في `docs/handoff/keys/keys-nav.json`.
- ✅ اتدمجت ترجمات `keys-gamification.json` و`keys-nav.json` في `messages/*.json` (2804 مفتاح، العربي والإنجليزي متطابقين).
- ⏳ لسه: النافبار (رابط ولي الأمر `/parent`)، و`CourseTutor` في صفحة الدرس، و`LessonTranscriptField`، وربط النقاط بالامتحانات والواجبات، وكروت اللوحات الرئيسية، ودمج ترجمات باقي الميزات بعد ما الـ agents بتوعها يخلصوا.
- ⚠️ الجلسات بتقفل كتير، والـ agents بيقفوا معاها. كل مرة لازم يتبعتلهم يكمّلوا (SendMessage)، أو تكمّل الميزة بنفسك من جدول قسم 3-ب.

### 🔧 تحديث (Lead) — 8 من 9 ميزات خلصت
- ✅ خلصوا ونجحت اختباراتهم: النقاط والـ PWA (9/9)، المدرسة والواجبات (13/13)، الامتحانات (18/18)، حماية الفيديو (11/11)، الحضور والمصاريف (17/17)، المؤسسات (11/11)، الذكاء الاصطناعي (9/9)، أولياء الأمور (13/13).
- ⏳ الأكواد والمحفظة: لسه شغال (spec 21).
- ✅ ترجماتهم كلها اتدمجت (4219 مفتاح)، ما عدا keys-wallet.json لحد ما الـ agent بتاعه يخلص.
- ✅ ربط اتعمل: النقاط في الامتحان والتصحيح اليدوي والواجبات، والمساعد الذكي في صفحة الدرس، وحقل نص الدرس في محرر الدرس، ورابط ولي الأمر في النافبار، وسعة المجموعة عند إضافة طالب، وcallbackUrl في صفحة التسجيل، وفئات جديدة في فلتر سجل النشاط، وتنظيف أجهزة الحسابات التجريبية في global-setup، وإصلاح قيم مزوّد الفيديو في محرر الدرس (UPLOADTHING/CUSTOM).
- ⏳ لسه: كروت اللوحات الرئيسية، وtsc وكل الاختبارات وnext build، وصور التصميم، والـ commits والرفع (محتاج موافقة على prisma db push لـ Neon).
### 🔧 تحديث (Lead) — الـ 9 ميزات خلصوا
- ✅ الأكواد والمحفظة خلصت (13/13). كل الـ agents سلّموا تقاريرهم.
- ✅ كل الترجمات اتدمجت (4450 مفتاح، مفيش مفاتيح ناقصة).
- ✅ كروت جديدة في لوحة الطالب (النقاط، الأيام المتتالية، المحفظة، الواجبات المطلوبة) ولوحة المعلم (مقالات للتصحيح، حصص النهارده، مصاريف متأخرة). زرار المحفظة والكود اتضاف في صفحة المعلم العامة.
- ✅ `tsc` و`next lint` نضاف على المشروع كله.
- ⏳ دلوقتي: تشغيل كل اختبارات QA، وبعدها next build، وصور التصميم، والـ commits، والرفع.

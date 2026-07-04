# ElearningPro — Comprehensive Test Plan

> **Version:** 1.4  
> **Author:** QA Engineering  
> **Scope:** Next.js 14 + Prisma + PostgreSQL + NextAuth v5 + Stripe + LiveKit + Socket.IO + next-intl  
> **Baseline:** بعد ريفاكتور الأمان والأخطاء النوعية

**Changelog v1.1:** أُعيد التحقق من كل الأخطاء الحرجة المذكورة في v1.0 مقابل الكود الحالي (Socket.IO auth, webhook idempotency/atomicity, حقول الكوبون, rate limit الشهادة) — **كلها لا تزال مُصلَحة فعليًا**. أُضيف: قسم صريح لـ Relations & Data Integrity (§3.0)، جدول Page-by-Page شامل لكل صفحة (§3.17)، مصفوفة تغطية كل API route + الكشف عن مسارات مكرّرة/ميتة (§3.18)، وBUG-033/BUG-034 الجديدان.

**Changelog v1.2:** تم إصلاح كل الأخطاء المفتوحة القابلة للإصلاح مباشرة بالكود: **BUG-026** (ترجمة الـ616 مفتاحًا الناقصة بالكامل، تحقق 0 فجوة)، **BUG-033/BUG-035** (حذف الكود الميت: مكوّن `QuizPlayer` وroute الاختبار اليتيم، وroute التقدّم اليتيم `progress/[lessonId]`)، **BUG-034** (إضافة `app/error.tsx` + `app/global-error.tsx` + `app/not-found.tsx` مترجمة ومتوافقة مع RTL)، **QZ-008** (rate limiting على `quiz/start` و`quiz/submit`، 20/دقيقة لكل مستخدم). تم **تأجيل** BUG-027 (دمج LiveSession/LiveClass) وBUG-032 (استضافة Socket.IO) بقرار من المستخدم لحاجتهما لقرار/migration خارج نطاق هذا التعديل، و**اعتماد** BUG-028 كسلوك مقصود، و**تخطي** BUG-029/030 (تتطلب بيانات اعتماد ونطاق عمل جديد). BUG-031 (انحراف العدّادات) لا يزال مفتوحًا. ملاحظة: `tsc --noEmit` كشف عن 30 خطأ TypeScript موجودة مسبقًا (`searchParams`/`pathname` قد تكون `null`) في ملفات لم تُمَس بهذا التعديل — تناقض الادعاء بـ"0 TS errors" في القاعدة الأساسية، ولم تكن ضمن نطاق هذا الطلب.

---

## 1. Executive Summary

منصة تعليمية عربية/إنجليزية معقّدة، تشتمل على تدفقات مالية حساسة (Stripe + عمولة المدرّس + كوبونات + سحوبات)، وبث مباشر (LiveKit)، ومراسلة realtime (Socket.IO). Audit الأمني السابق كشف عن **6 أخطاء حرجة كانت تُعطّل المدفوعات فعليًا**، وتجاوز مصادقة Socket، وثغرات brute-force على الشهادات. تمّ إصلاح معظمها في الريفاكتور الحالي؛ هذه الخطة تُوثّق كل حالات الاختبار لضمان عدم عودة الانحدار (Regression) ولاكتشاف أي فجوات متبقية.

### 1.1 Risk Matrix

| Area | Impact | Likelihood | Priority | Owner |
|---|---|---|---|---|
| Payment webhook (idempotency, atomicity) | Critical | High | **P0** | Backend |
| Coupon race conditions & schema fields | Critical | Medium | **P0** | Backend |
| Socket.IO auth bypass | Critical | High | **P0** | Backend |
| Certificate verify brute-force | High | High | **P1** | Backend |
| Instructor withdrawal atomic decrement | High | Medium | **P1** | Backend |
| Course access control (enrollment, IDOR) | High | Medium | **P1** | Backend |
| Quiz grading integrity (server-side) | Critical | Low | **P1** | Backend |
| RTL/i18n coverage | Medium | High | **P2** | Frontend |
| Live session token authorization | High | Low | **P1** | Backend |
| Session subscription enforcement | Medium | Medium | **P2** | Backend |
| XSS via `dangerouslySetInnerHTML` | High | Low (mitigated by DOMPurify) | **P1** | Frontend |
| ~~Denormalized counters drift~~ | — | — | **FIXED** | Backend |
| Free course price-change loophole | Medium | Low | **P2** | Backend |
| ~~Duplicate/orphaned API routes still callable (quiz, progress)~~ | — | — | **FIXED** | Backend |
| ~~No `error.tsx`/`not-found.tsx` anywhere in the app~~ | — | — | **FIXED** | Frontend |

**Severity legend:** P0 = block release · P1 = fix before GA · P2 = fix in next sprint

---

## 2. Test Coverage Scope

### In scope
- كل صفحات `app/(auth)`, `app/(main)`, `app/api/**`
- كل المكوّنات في [components/](components) (admin/instructor/student/learn/live/checkout/courses/messages/quiz/certificate)
- كل تدفقات الأدوار الثلاثة (STUDENT / INSTRUCTOR / ADMIN)
- كل تدفقات الدفع (Stripe فقط — PayPal/Paymob/Tap = stubs تعيد 501)
- LiveKit token generation + join flow
- Socket.IO authenticated messaging
- i18n (ar/en) + RTL/LTR
- Middleware protection ([middleware.ts](middleware.ts))
- Rate limiting ([lib/rate-limit.ts](lib/rate-limit.ts))
- File upload validation ([app/api/upload/route.ts](app/api/upload/route.ts))

### Out of scope (لا تُختبر لهذه الجولة)
- بوابات PayPal/Paymob/Tap — stubs
- Subscription payment integration — TODO
- Email deliverability (SMTP/Resend) — sandbox فقط
- Load testing تحت > 10k concurrent (يتطلب بيئة staging مخصّصة)

### Environments
| Env | Purpose | DB | Stripe | LiveKit |
|---|---|---|---|---|
| Local | Dev + unit tests | PostgreSQL local | Test keys | Sandbox |
| Staging | Full E2E + security scan | staging DB | Test keys | Sandbox |
| Production | Smoke tests فقط | prod | Live keys | Prod |

---

## 3. Test Cases

### 3.0 Relations & Data Integrity (Cross-Entity Test Cases)

هذه حالات تختبر تناسق البيانات عبر جداول مترابطة مباشرة (لا نموذج واحد)، بمعزل عن أي endpoint واحد — الهدف اكتشاف Data Inconsistency لا يظهر إلا عند تتبّع السلسلة كاملة.

| Test ID | Relation Chain | Scenario | Steps | Expected | Priority |
|---|---|---|---|---|---|
| REL-001 | Enrollment ↔ Purchase | كل `Purchase.status=COMPLETED` لكورس مدفوع له `Enrollment` مطابق (`userId`+`courseId`) | `SELECT` كل completed purchases لكورس price>0 وقارن بـ enrollments | 1:1 مطابقة تامة، لا purchase بلا enrollment | **P0** |
| REL-002 | Enrollment ↔ Progress | `Enrollment.progress` = نسبة `Progress.isCompleted=true` من إجمالي الدروس المنشورة في الكورس | أكمل 3 من 10 دروس → افحص `enrollment.progress` | = 30 (مطابق لحساب `updateCourseProgress`) | P0 |
| REL-003 | Progress ↔ Certificate | لا يوجد `Certificate` لمستخدم لم يصل `Enrollment.isCompleted=true` | افحص كل certificates → تحقق من enrollment المطابق | 100% من الشهادات لديها enrollment مكتمل | **P0** |
| REL-004 | Enrollment ↔ Certificate (uniqueness) | مستخدم لا يمكن أن يملك أكثر من شهادة واحدة لنفس الكورس | أكمل الكورس مرتين (إعادة تعيين progress يدويًا) → اطلب شهادة | Unique constraint `userId_courseId` يمنع التكرار | P1 |
| REL-005 | Coupon ↔ Purchase | `Purchase.discountAmount` غير صفري ⇒ `Purchase.couponId` غير null، والعكس | افحص كل purchases بخصم | لا purchase بخصم بلا couponId مرتبط | P1 |
| REL-006 | Coupon ↔ Purchase (usedCount) | `Coupon.usedCount` = `COUNT(Purchase WHERE couponId=X)` فعليًا | استخدم كوبون 3 مرات من مستخدمين مختلفين → قارن العدّاد بالعدّ الفعلي | تطابق تام (لا drift) | **P0** — يرتبط بـ BUG-031 |
| REL-007 | Instructor Earnings ↔ Payments | `InstructorProfile.totalEarnings` = `SUM(Purchase.instructorShare)` لكل مشترياته | نفّذ 5 عمليات شراء لمدرّس واحد → قارن المجموع | تطابق؛ أي انحراف = دليل على bug في webhook أو خصم مزدوج | **P0** |
| REL-008 | Instructor Earnings ↔ Withdrawals | `pendingEarnings + paidEarnings + (SUM withdrawals PENDING/APPROVED)` لا يتجاوز `totalEarnings` | نفّذ سحوبات متعددة بحالات مختلفة | لا bypass للسقف الكلي | **P0** |
| REL-009 | Quiz ↔ Attempt ↔ Answer | كل `QuizAnswer` مرتبطة بـ `QuizAttempt` ينتمي لنفس `Quiz` الذي يملك `Question` | افحص FK chain لعيّنة عشوائية | لا orphan answers، لا اختلاط أسئلة من quiz آخر | P1 |
| REL-010 | Quiz ↔ Attempt (best score) | حساب شهادة الدرجة يعتمد على "أفضل محاولة" وليس آخر محاولة | أدِّ الاختبار 3 مرات بنتائج متفاوتة (80%, 60%, 95%) | Certificate.grade يعكس 95% | P1 |
| REL-011 | LiveSession/LiveClass ↔ Course | كل جلسة بث مرتبطة بكورس موجود ومنشور، ولا تظهر لغير المسجَّلين | أنشئ live class لكورس DRAFT | لا تظهر في `/student/live` لأي طالب | P1 |
| REL-012 | LiveSession ↔ LiveClass duplication (BUG-027) | النموذجان `LiveSession` و`LiveClass` قد يحملان بيانات متضاربة لنفس الحدث | ابحث عن سجلات بنفس `courseId`+`scheduledAt` في كلا الجدولين | يجب ألا يوجد ازدواج فعلي في الاستخدام الحالي؛ وثّق أي حالة | **P2** — Open (BUG-027) |
| REL-013 | Category ↔ Course (children) | حذف تصنيف له كورسات تابعة | Admin يحذف category مرتبط بكورسات | يُرفض الحذف أو `onDelete` policy واضحة (لا orphan `categoryId`) | P1 |
| REL-014 | Review ↔ Enrollment | مستخدم غير مسجَّل بالكورس لا يمكنه إضافة review | POST `/api/courses/${courseId}/reviews` بدون enrollment | 403 | **P0** |
| REL-015 | Review ↔ Course rating aggregate | `Course.averageRating`/`totalReviews` تطابق `AVG`/`COUNT` الفعلي من جدول Review | أضف/عدّل/احذف reviews متعددة | تطابق فوري بعد كل عملية (لا drift) | P2 — يرتبط بـ BUG-031 |

### 3.1 Authentication ([app/(auth)](app/(auth)), [lib/auth.ts](lib/auth.ts))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| AUTH-001 | Positive | تسجيل مستخدم جديد بـ email/password صحيح | POST `/api/auth/register` مع بيانات صحيحة | 201 + user record + hashed password (bcrypt cost 12) | P0 | — |
| AUTH-002 | Negative | تسجيل بـ email مكرّر | تسجيل مرتين بنفس الإيميل | 400 + "already exists" | P0 | — |
| AUTH-003 | Security | Password length < 6 | password="12345" | 400 validation error | P0 | — |
| AUTH-004 | Security | Rate limit على register | 6 محاولات < دقيقة من نفس IP | آخر محاولة → 429 | P0 | Missing rate limiting |
| AUTH-005 | Security | Rate limit على forgot-password | 4 محاولات > 3 مسموحة | 429 | P0 | Missing rate limiting |
| AUTH-006 | Positive | Login بـ credentials صحيحة | POST NextAuth signin | JWT session cookie + role in token | P0 | — |
| AUTH-007 | Negative | Login بحساب `isBlocked=true` | User.isBlocked=true → login | 401 + "account blocked" رسالة | P0 | — |
| AUTH-008 | Positive | Google OAuth | Redirect → callback → session | user created أو linked + role=STUDENT default | P1 | — |
| AUTH-009 | Positive | GitHub OAuth | Redirect → callback → session | user created أو linked | P1 | — |
| AUTH-010 | Security | Forgot password → email enumeration | طلب reset لـ email موجود وآخر غير موجود | نفس رسالة الاستجابة (لا كشف عن الوجود) | P1 | Email enumeration timing |
| AUTH-011 | Positive | Reset password flow | forgot → استلام link → validate token → set new password | 200 + `PasswordResetToken` محذوف + user.password جديد | P0 | resetToken field mismatch (fixed) |
| AUTH-012 | Negative | Reuse reset token | استخدام token مرتين | ثاني مرة → 400 invalid token | P0 | — |
| AUTH-013 | Negative | Expired reset token (> 1h) | استخدام بعد ساعة | 400 expired | P0 | — |
| AUTH-014 | Security | Reset token tampering | تغيير token في URL | 400 | P0 | — |
| AUTH-015 | Security | Session hijacking (JWT tampering) | تعديل role في JWT client-side | Server يرفض (توقيع مكسور) | P0 | — |
| AUTH-016 | Positive | Logout يمسح الـ session | signOut() ثم زيارة `/instructor` | Redirect للـ login | P1 | — |
| AUTH-017 | Edge | Redirect callback يمنع open redirect | callbackUrl=`https://evil.com` | Redirect للـ baseUrl فقط | P0 | — |

### 3.2 Middleware & Route Protection ([middleware.ts](middleware.ts))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| MW-001 | Security | زائر يزور `/admin` | بدون token | Redirect `/login?callbackUrl=/admin` | P0 | Missing middleware (fixed) |
| MW-002 | Security | Student يزور `/admin` | role=STUDENT | Redirect `/` | P0 | Client-side check bypass |
| MW-003 | Security | Instructor يزور `/admin` | role=INSTRUCTOR | Redirect `/` | P0 | — |
| MW-004 | Security | Admin يزور `/instructor` | role=ADMIN | يُسمح (admin يرى كل شيء) | P1 | — |
| MW-005 | Security | Student يزور `/instructor/courses` | role=STUDENT | Redirect `/` | P0 | Client-side leak |
| MW-006 | Positive | Instructor يزور `/instructor` | role=INSTRUCTOR | يُسمح | P0 | — |
| MW-007 | Security | Student يزور `/student` | role=STUDENT | يُسمح | P0 | — |
| MW-008 | Security | زائر يزور `/student/courses` | بدون token | Redirect للـ login مع callbackUrl | P0 | — |
| MW-009 | Edge | Token expired أثناء التصفح | JWT expiry | Redirect للـ login | P1 | — |

### 3.3 Checkout & Payment Flow (**P0 CRITICAL**)

**Files:** [app/(main)/checkout/[slug]/page.tsx](app/(main)/checkout/%5Bslug%5D/page.tsx), [app/api/payments/create/route.ts](app/api/payments/create/route.ts), [app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts), [components/checkout/checkout-form.tsx](components/checkout/checkout-form.tsx)

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| PAY-001 | Positive | شراء كورس مدفوع بـ Stripe | مستخدم مسجّل → checkout → Stripe test card 4242 → webhook | Purchase created + Enrollment created + instructor.pendingEarnings +=share + email sent | **P0** | webhook balance field crash (fixed) |
| PAY-002 | Critical | Idempotency: نفس الـ event مرتين | Stripe يعيد إرسال webhook (نفس event.id) | Purchase واحد فقط + Enrollment واحد + earnings تُضاف مرة واحدة | **P0** | Missing idempotency (fixed) |
| PAY-003 | Critical | Atomicity: crash في منتصف webhook | Kill server بعد Purchase قبل Enrollment | إما الاثنان موجودان أو ولا واحد (transaction rollback) | **P0** | Not atomic (fixed via $transaction) |
| PAY-004 | Positive | حقول Purchase صحيحة | فحص Purchase في DB بعد نجاح الدفع | `instructorShare`, `platformShare`, `discountAmount`, `providerId` كلها مملوءة صحيحة | **P0** | Missing financial breakdown (fixed) |
| PAY-005 | Security | Webhook signature invalid | إرسال webhook بلا `stripe-signature` أو موقّع بمفتاح خاطئ | 400 + لا يُنشأ شيء | **P0** | — |
| PAY-006 | Security | Price tampering client-side | تعديل `amount` في request | Server يستخدم `course.price` من DB (يتجاهل client) | **P0** | — |
| PAY-007 | Negative | Course price=0 يصل لـ checkout | محاولة دفع كورس مجاني | 400 أو redirect للـ enroll مباشرة | P1 | Free course edge |
| PAY-008 | Negative | Course status != PUBLISHED | admin يخفي الكورس بعد بدء checkout | 404 course not found | P1 | — |
| PAY-009 | Positive | Coupon percentage صالح | كوبون -20% | finalPrice = price*0.8, `discountAmount` مسجّل | **P0** | Coupon field `expiresAt`→`expiryDate` (fixed) |
| PAY-010 | Positive | Coupon fixed amount | كوبون -50 ريال | finalPrice = max(0, price-50) | P0 | — |
| PAY-011 | Positive | Coupon مع maxDiscount cap | كوبون 50% + maxDiscount=100 على كورس 500 | discount = 100 (لا 250) | P0 | — |
| PAY-012 | Negative | Coupon منتهي | expiryDate < now | 400 "expired coupon" | **P0** | Wrong field name (fixed) |
| PAY-013 | Negative | Coupon inactive | isActive=false | 400 | P0 | — |
| PAY-014 | Negative | Coupon minPurchase غير مستوفى | كورس 30 + coupon.minPurchase=100 | 400 "minimum not met" | P0 | Missing check (fixed) |
| PAY-015 | Negative | Coupon استُخدم قبلاً من نفس المستخدم | Purchase موجود بـ couponId=X, userId=Y | 400 | P0 | — |
| PAY-016 | Critical | Coupon race: maxUses=1 مع طلبين متزامنين | 2 requests بنفس اللحظة | Purchase واحد فقط، الآخر يفشل | **P0** | Race condition |
| PAY-017 | Negative | Coupon `discountType="PERCENTAGE"` casing | القيمة في DB="percentage" | يعمل (case-normalized) | P0 | Casing bug (fixed) |
| PAY-018 | Critical | Instructor commission يقرأ من إعدادات المنصة | تغيير commissionRate=25% | webhook يستخدم القيمة الجديدة | **P0** | Hardcoded 20% (fixed) |
| PAY-019 | Security | Already enrolled student يحاول شراء مجدّدًا | Enrollment exists | 400 "already enrolled" | P0 | — |
| PAY-020 | Positive | Success page يعرض الكورس + رابط `/learn` | بعد الدفع | Link صحيح لأول درس منشور | P1 | — |
| PAY-021 | Negative | Stripe checkout cancel | User يضغط cancel في Stripe | Redirect لـ `/checkout/${slug}` بلا Purchase | P1 | — |
| PAY-022 | Edge | Currency تحويل | course بـ EGP، Stripe amount = price*100 (piaster) | حساب صحيح | P0 | — |
| PAY-023 | Positive | Email confirmation | بعد نجاح الدفع | Email مرسل بـ course titleEn/Ar + amount | P1 | course.title crash (fixed) |
| PAY-024 | Security | Webhook replay attack (5 دقائق لاحقًا) | نفس event.id | idempotency يحمي | **P0** | — |

### 3.4 Coupons ([app/api/coupons/validate/route.ts](app/api/coupons/validate/route.ts), [app/api/admin/coupons/**](app/api/admin/coupons))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| COUP-001 | Positive | Admin ينشئ كوبون | POST مع code, discountType, discountValue | 201 + code uppercase | P1 | — |
| COUP-002 | Negative | كوبون بـ discountValue سالب | -10 | 400 validation | P1 | — |
| COUP-003 | Negative | Non-admin ينشئ كوبون | Student token | 403 | P0 | — |
| COUP-004 | Positive | Coupon محدّد بكورس معيّن | courseId=X | يعمل فقط على X، يُرفض على Y | P1 | — |
| COUP-005 | Edge | Coupon usedCount >= maxUses | 10/10 | 400 exhausted | **P0** | Race condition |
| COUP-006 | Positive | validate route يعيد discount amount | validate endpoint | يرجع {discount, finalPrice} صحيح | P1 | — |
| COUP-007 | Security | Coupon code injection (SQL) | code=`'; DROP TABLE`` | Prisma يعزل (parameterized) | P0 | — |

### 3.5 Enrollment ([app/api/courses/[courseId]/enroll/route.ts](app/api/courses/%5BcourseId%5D/enroll/route.ts))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| ENR-001 | Positive | Enroll في كورس مجاني | course.price=0 | 201 + Enrollment record | P0 | — |
| ENR-002 | Negative | Enroll بدون auth | زائر | 401 | P0 | — |
| ENR-003 | Negative | Enroll في كورس مدفوع مباشرة | course.price>0 → POST enroll | 402 payment required + redirectTo | P0 | — |
| ENR-004 | Negative | Enroll مرتين | نفس user+course | 400 already enrolled | P0 | — |
| ENR-005 | Edge | Course status=DRAFT | يحاول enroll | 404 course not found | P0 | — |
| ENR-006 | Edge | Free-then-paid loophole | Enroll مجاني ثم admin يجعله مدفوع → user يصل للمحتوى | User يبقى لديه وصول (سلوك حالي) | P2 | Free-course edge (documented) |

### 3.6 Learning ([app/(main)/courses/[slug]/learn/[[...lessonId]]/page.tsx](app/(main)/courses/%5Bslug%5D/learn/%5B%5B...lessonId%5D%5D/page.tsx))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| LRN-001 | Positive | Enrolled user يفتح `/learn` بدون lessonId | Redirect لأول درس منشور | 307 redirect | P0 | — |
| LRN-002 | Security | Non-enrolled يفتح `/learn/xyz` | يُعاد لـ `/courses/${slug}` | لا يرى محتوى | **P0** | — |
| LRN-003 | Positive | Instructor يفتح كورسه بدون enroll | course.instructorId === session.user.id | يُسمح (preview) | P1 | Fixed in [[...lessonId]] |
| LRN-004 | Positive | Video player يحفظ progress كل 10s | يشغّل درسًا 15s | POST `/api/progress/lesson` مع watchedDuration | P0 | — |
| LRN-005 | Positive | Auto-complete عند 90% | تشغيل > 90% من مدة الدرس | isCompleted=true في DB | P0 | — |
| LRN-006 | Security | POST progress لدرس ليس ضمن enrollment | user يزوّر lessonId | 403 "not enrolled" | **P0** | IDOR |
| LRN-007 | Positive | Sidebar تعرض progress لكل درس | userId_lessonId compound key | ✓ لكل درس مكتمل | P1 | Progress schema (fixed) |
| LRN-008 | Positive | Navigation Prev/Next | ضغط next | Navigate للـ nextLesson.id | P1 | — |
| LRN-009 | Edge | Lesson موجود لكن غير منشور | isPublished=false | notFound | P0 | — |
| LRN-010 | Edge | Chapter غير منشور لكن Lesson منشور | isPublished chapter=false | notFound (filter مضاعف) | P0 | — |
| LRN-011 | Positive | Attachments تظهر مع الدرس | lesson.attachments موجودة | تظهر مع أسمائها | P1 | resources→attachments (fixed) |
| LRN-012 | Security | XSS في description | description=`<script>alert(1)</script>` | DOMPurify يعقّم | **P0** | Fixed |

### 3.7 Quiz ([app/api/quiz/**](app/api/quiz), [app/api/quizzes/**](app/api/quizzes))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| QZ-001 | Positive | Student يبدأ attempt | POST `/api/quiz/attempt` | 201 + attemptId | P0 | — |
| QZ-002 | Security | GET quiz لا يعيد `isCorrect` للـ students | fetch `/api/quizzes/${lessonId}` كطالب | كل option بلا `isCorrect` | **P0** | Filtered server-side |
| QZ-003 | Security | GET quiz يعيد `isCorrect` للـ instructor | نفس endpoint كمدرّس/admin | isCorrect ظاهر | P0 | — |
| QZ-004 | Critical | Submit answers → server-side grading | POST مع answers | Score محسوب server-side من DB (لا يُثق بـ client) | **P0** | — |
| QZ-005 | Security | Client يرسل score مباشرة | POST مع {score: 100} | Server يتجاهله ويحسب بنفسه | **P0** | — |
| QZ-006 | Negative | Submit بدون enrollment | 403 | P0 | — |
| QZ-007 | Positive | Best score يُحسب للـ certificate | quiz مرتين، أعلى درجة تُستخدم | ✓ | P1 | — |
| QZ-008 | Edge | Rate limit على quiz submit/start | 21 محاولة في دقيقة لنفس المستخدم | 429 | P1 | **FIXED** — `rateLimit()` مضاف لـ `quiz/start` و`quiz/submit` (20/min per user) |
| QZ-009 | Negative | Submit لـ attempt مكتمل بالفعل | 400 already submitted | P1 | — |

### 3.8 Certificates ([app/api/certificates/**](app/api/certificates), [app/(main)/verify/[certificateNo]](app/(main)/verify/%5BcertificateNo%5D))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| CERT-001 | Positive | Issue certificate بعد إكمال كورس | enrollment.isCompleted=true | POST `/api/certificates/${courseId}` → 201 + certificateNo (UUID) | P0 | — |
| CERT-002 | Negative | Issue قبل الإكمال | isCompleted=false | 400 | **P0** | — |
| CERT-003 | Security | Non-enrolled يحاول issue | 403 | **P0** | IDOR |
| CERT-004 | Positive | Grade يُحسب من أفضل quiz scores | user أدّى quizzes | grade = average(best scores) | P1 | — |
| CERT-005 | Critical | Verify endpoint public + rate limited | 6 requests > 5/min | 429 | **P0** | Brute-force (fixed) |
| CERT-006 | Security | Enumerate certificate numbers | Sequential UUIDs | UUIDs عشوائية + rate limit يمنع | **P0** | — |
| CERT-007 | Positive | Verify يعرض name/course/grade/date | GET `/verify/${cn}` | تفاصيل بلا PII حسّاسة | P1 | — |
| CERT-008 | Negative | Verify certificate غير موجود | GET `/verify/fake` | صفحة "invalid certificate" | P1 | — |
| CERT-009 | Positive | Verify يستخدم `titleEn` (schema-correct) | fetch | ✓ | P0 | title→titleEn (fixed) |

### 3.9 Live Sessions ([lib/livekit.ts](lib/livekit.ts), [app/api/live/**](app/api/live))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| LIVE-001 | Positive | Instructor يبدأ live class | POST `/api/live/${id}/start` | Room created + token (host permissions) | P0 | — |
| LIVE-002 | Security | Non-instructor يحاول start | 403 | **P0** | Ownership check |
| LIVE-003 | Positive | Enrolled student ينضم | POST `/join` | Token student (canSubscribe فقط) | P0 | — |
| LIVE-004 | Security | Non-enrolled يحاول join | 403 | **P0** | — |
| LIVE-005 | Security | Token binding per-room | Token لـ room A لا يعمل في room B | LiveKit يرفض | P0 | — |
| LIVE-006 | Security | LIVEKIT_API_SECRET لا يُسرَّب للـ client | فحص network tab | لا secret في response | **P0** | Server-only |
| LIVE-007 | Positive | generateToken async يُنتظر (SDK جديد) | فحص كل call sites | `await generateToken(...)` | P0 | Fixed |
| LIVE-008 | Positive | Class status=SCHEDULED وليس host | Student يفتح `/live/${id}` قبل البداية | صفحة "hasn't started" | P1 | — |
| LIVE-009 | Positive | Class status=ENDED | فتح live قديم | "class ended" | P1 | — |
| LIVE-010 | Edge | Class status=LIVE + reload | Student يعيد التحميل | يحصل على token مجددًا بدون duplicate join | P1 | — |

### 3.10 Socket.IO Messaging ([pages/api/socket/io.ts](pages/api/socket/io.ts), [providers/socket-provider.tsx](providers/socket-provider.tsx))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| SOCK-001 | Critical | Unauthenticated socket connection | Connect بلا JWT | Server يقطع الاتصال | **P0** | Auth bypass (fixed) |
| SOCK-002 | Critical | Spoof userId عبر handshake.auth | Malicious client يرسل userId=X | Server يتحقق من JWT ويستخدم verified id فقط | **P0** | Fixed |
| SOCK-003 | Positive | Authenticated client يتلقى رسائله فقط | User A يرسل لـ B، C متصل | فقط B و A يتلقّون الحدث | P0 | — |
| SOCK-004 | Security | Send message لـ user غير موجود | API layer يرفض | 404 | P0 | — |
| SOCK-005 | Edge | Vercel serverless deployment | Socket.IO on serverless | لا يعمل → يجب self-host أو managed | P1 | Documented limitation |
| SOCK-006 | Positive | Typing / stop-typing broadcast | Emit typing event | Recipient يرى المؤشّر | P2 | — |

### 3.11 Instructor Dashboard ([app/(main)/instructor/**](app/(main)/instructor))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| INST-001 | Positive | Server-side auth check | Zero-network-render | يمنع الوميض للـ instructor page | P0 | Fixed (client → server) |
| INST-002 | Security | Instructor يعدّل كورس آخر | PATCH `/api/instructor/courses/${otherId}` | 403 (ownership check) | **P0** | — |
| INST-003 | Security | Instructor يعدّل chapter داخل كورس آخر | Full chain check (course→chapter→lesson) | 403 | **P0** | — |
| INST-004 | Positive | Filter courses by status=PENDING_REVIEW | Dashboard tab | يعرض الصحيح | P1 | Fixed (PENDING → PENDING_REVIEW) |
| INST-005 | Positive | Enrollments recent list | Order by `enrolledAt` desc | ✓ (لا `createdAt`) | P1 | Fixed |
| INST-006 | Positive | Analytics monthly data | 6 شهور اشتراكات | groups صحيحة | P1 | Typed monthlyData |
| INST-007 | Positive | Earnings breakdown | pendingEarnings/paidEarnings | يطابق مجموع Purchases | P0 | — |
| INST-008 | Critical | Withdrawal request atomic | Two concurrent requests, balance=100, each 60 | Second → 400 insufficient balance | **P0** | Race (fixed via updateMany) |
| INST-009 | Positive | Withdrawal PENDING → APPROVED → COMPLETED | Admin موافقة → transfer | pendingEarnings decrement + paidEarnings increment (only on COMPLETED) | P0 | Fixed |
| INST-010 | Positive | Withdrawal PENDING → REJECTED | Admin يرفض | pendingEarnings يرجع بلا خصم | P0 | Fixed |
| INST-011 | Positive | Publish course validation | كورس بلا lessons | 400 "must have lessons" | P1 | — |
| INST-012 | Positive | Total duration = sum(videoDuration) | Publish check | ✓ | P1 | Fixed (duration → videoDuration) |
| INST-013 | Positive | Create course form categories | يعرض nameAr/nameEn | ✓ | P1 | Fixed (name → nameEn) |
| INST-014 | Positive | Course editor chapter/lesson CRUD | Add/edit/delete/reorder | كلها تعمل بلا console errors | P1 | Fixed interfaces |

### 3.12 Admin Panel ([app/(main)/admin/**](app/(main)/admin))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| ADM-001 | Security | Non-admin يزور `/admin` | Student token | Redirect `/` (middleware + layout) | **P0** | — |
| ADM-002 | Security | Admin self-demotion prevention | PATCH self role=STUDENT | 400 | P0 | — |
| ADM-003 | Positive | Course approval flow | admin PATCH status=PUBLISHED | Notification + publishedAt set | P0 | Fixed (course.title → titleEn) |
| ADM-004 | Positive | Course rejection with reason | PATCH status=REJECTED + reason | Notification sent | P0 | — |
| ADM-005 | Positive | Feature/unfeature course | PATCH isFeatured | Homepage updates | P1 | — |
| ADM-006 | Positive | Users table displays enrollments with `titleEn` | Fetch user detail | ✓ | P1 | Fixed |
| ADM-007 | Positive | Payments table formatDate Date object | admin/payments | لا crash | P1 | Fixed (string → Date\|string) |
| ADM-008 | Positive | Reviews table same | admin/reviews | ✓ | P1 | Fixed |
| ADM-009 | Positive | Settings CRUD | Update platformFee | يُقرأ في next payment | P0 | — |
| ADM-010 | Positive | Withdrawals approval | admin approve → COMPLETED | Balance transitions correct | P0 | — |
| ADM-011 | Security | Admin analytics بيانات لكل المنصة | GET `/api/admin/analytics` | تجميع صحيح | P1 | — |

### 3.13 Student Dashboard ([app/(main)/student/**](app/(main)/student))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| STU-001 | Positive | My courses list | GET student page | Enrollments with progress % | P0 | — |
| STU-002 | Positive | Nullable instructor name display | instructor.name=null | fallback "?" بدون crash | P1 | Fixed |
| STU-003 | Positive | Purchases list | uses `db.purchase` | ✓ | P0 | Fixed (payment→purchase) |
| STU-004 | Positive | Certificates list | Earned certificates | Downloadable | P1 | — |
| STU-005 | Positive | Wishlist add/remove | Toggle | POST /wishlist works | P2 | — |

### 3.14 Public Courses Pages

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| PUB-001 | Positive | `/courses` list + filters | Category/level/price/rating filters | Query params work | P0 | — |
| PUB-002 | Positive | `/courses/[slug]` public view | لا auth | Description + sidebar visible | P0 | Fixed DOMPurify + interface |
| PUB-003 | Security | Locked lesson video URL | Non-enrolled | لا يُرسل videoUrl للـ client | **P0** | — |
| PUB-004 | Positive | RTL rendering when locale=ar | HTML dir="rtl" | ms-/me-/start-/end- classes | P1 | 53 fixes applied |
| PUB-005 | Positive | LTR rendering when locale=en | HTML dir="ltr" | Mirror correctly | P1 | — |
| PUB-006 | Positive | Categories with children | Nested nav | Displays نفس شكل الـ interface | P1 | Fixed |
| PUB-007 | Positive | Instructor profile page | headline/bio من User (لا instructorProfile) | ✓ | P1 | Fixed |
| PUB-008 | Positive | `course.price===0` displays "free" badge | لا حقل isFree | ✓ | P1 | Fixed |

### 3.15 File Upload ([app/api/upload/route.ts](app/api/upload/route.ts))

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| UPL-001 | Positive | Valid PNG upload | POST image | 200 + URL | P0 | — |
| UPL-002 | Security | MIME spoofing (exe مع Content-Type=image/png) | sharp يفحص الأبعاد | 400 invalid image | **P0** | Fixed |
| UPL-003 | Security | Oversize file (> limit) | 100MB image | 413 | P1 | — |
| UPL-004 | Security | Unauthenticated upload | 401 | **P0** | — |
| UPL-005 | Edge | Corrupt image | sharp يفشل | 400 | P1 | — |

### 3.16 i18n & RTL

| Test ID | Category | Scenario | Steps | Expected | Priority | Related Audit Issue |
|---|---|---|---|---|---|---|
| I18N-001 | Positive | Switch locale ar→en cookie | POST `/api/set-locale` | Cookie set + reload EN | P1 | — |
| I18N-002 | Edge | Missing en key falls back to ar | i18n/request.ts | Text عربي (لا خطأ) | P1 | 616 keys missing |
| I18N-003 | Positive | RTL Arabic layout | dir="rtl" | Icons flip, layout mirror | P1 | Fixed 53 files |
| I18N-004 | Positive | Number formatting per locale | 1,000 vs ١٬٠٠٠ | — | P2 | — |

### 3.17 Page-by-Page UI, Accessibility & State Coverage

**Loading state architecture (verified):** Next.js App Router uses the nearest ancestor `loading.tsx`. Only 5 exist: [app/(main)/loading.tsx](app/(main)/loading.tsx) (fallback for every page under the `(main)` group unless overridden), plus overrides for [admin](app/(main)/admin/loading.tsx), [courses](app/(main)/courses/loading.tsx), [instructor](app/(main)/instructor/loading.tsx), [student](app/(main)/student/loading.tsx). The `(auth)` group has **no** `loading.tsx`. **Error boundary architecture (verified):** there is **no** `error.tsx`, `global-error.tsx`, or `not-found.tsx` anywhere in `app/` — every thrown exception or `notFound()` call renders Next.js's default unstyled English page, breaking RTL/i18n/branding (**BUG-034**, new).

Every row below is a real page found via `app/**/page.tsx`. "Loading" = which loading.tsx actually governs it. "Error" is uniformly "None" until BUG-034 is fixed — listed once at the top, not repeated per row, except where a page has additional custom needs (e.g. skeleton for slow data).

| Test ID | Page | File | RTL/LTR | Loading (actual) | Responsive/A11y | Priority |
|---|---|---|---|---|---|---|
| PG-001 | Home | [app/(main)/page.tsx](app/(main)/page.tsx) | Hero/testimonials/stats mirror correctly | `(main)/loading.tsx` | Hero image `alt`, heading hierarchy, mobile nav collapse | P1 |
| PG-002 | Login | [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) | Form fields + labels RTL-aligned | **None** (no `(auth)/loading.tsx`) | Form labels, focus order, error text `aria-live` | P0 |
| PG-003 | Register | [app/(auth)/register/page.tsx](app/(auth)/register/page.tsx) | Same | None | Password strength indicator readable by SR | P0 |
| PG-004 | Forgot password | [app/(auth)/forgot-password/page.tsx](app/(auth)/forgot-password/page.tsx) | Same | None | Success/error message announced | P1 |
| PG-005 | Reset password | [app/(auth)/reset-password/page.tsx](app/(auth)/reset-password/page.tsx) | Same | None | Invalid/expired token state renders (no error.tsx to catch a thrown error) | **P0** |
| PG-006 | Courses list | [app/(main)/courses/page.tsx](app/(main)/courses/page.tsx) | Filter sidebar `start-`/`end-` not `left-`/`right-` | `courses/loading.tsx` skeleton grid | Filter checkboxes keyboard-navigable, pagination `aria-current` | P0 |
| PG-007 | Course detail | [app/(main)/courses/[slug]/page.tsx](app/(main)/courses/%5Bslug%5D/page.tsx) | Sidebar CTA mirrors to correct side | `courses/loading.tsx` (inherited) | `dangerouslySetInnerHTML` description must not break heading order; video preview has captions/alt | **P0** |
| PG-008 | Course redirect (legacy) | [app/(main)/course/[slug]/page.tsx](app/(main)/course/%5Bslug%5D/page.tsx) | N/A (redirect only) | N/A | Verify 308/307 redirect preserves query params | P2 |
| PG-009 | Categories | [app/(main)/categories/page.tsx](app/(main)/categories/page.tsx) | Grid mirrors | `(main)/loading.tsx` | Icons have text alternative | P2 |
| PG-010 | Instructors list | [app/(main)/instructors/page.tsx](app/(main)/instructors/page.tsx) | Card RTL | `(main)/loading.tsx` | Avatar `alt=name` | P2 |
| PG-011 | Instructor profile | [app/(main)/instructors/[id]/page.tsx](app/(main)/instructors/%5Bid%5D/page.tsx) | Bio dir-aware | `(main)/loading.tsx` | Same as PG-007 for `dangerouslySetInnerHTML` bio | P1 |
| PG-012 | Checkout | [app/(main)/checkout/[slug]/page.tsx](app/(main)/checkout/%5Bslug%5D/page.tsx) | Price/coupon fields RTL numerals | `(main)/loading.tsx` — **no dedicated skeleton for a payment page**; a slow Stripe session-create leaves a blank/jumping layout | Stripe iframe focus trap, coupon error `aria-live`, no thrown-error safety net (BUG-034 is highest-impact here — a crash mid-checkout shows Next's default page, user unsure if charged) | **P0** |
| PG-013 | Checkout success | [app/(main)/checkout/success/page.tsx](app/(main)/checkout/success/page.tsx) | Confirmation RTL | `(main)/loading.tsx` | Screen-reader announces success | P1 |
| PG-014 | Checkout subscription (stub) | [app/(main)/checkout/subscription/page.tsx](app/(main)/checkout/subscription/page.tsx) | N/A — TODO stub (BUG-029) | `(main)/loading.tsx` | Verify stub clearly communicates "coming soon", not a silent dead end | P2 |
| PG-015 | Learn / video player | [app/(main)/courses/[slug]/learn/[[...lessonId]]/page.tsx](app/(main)/courses/%5Bslug%5D/learn/%5B%5B...lessonId%5D%5D/page.tsx) | Sidebar/nav mirrors, video controls RTL-aware | `(main)/loading.tsx` only — **no skeleton for video buffering** | Video player keyboard controls, captions, progress bar `aria-valuenow` | **P0** |
| PG-016 | Quiz | [app/(main)/courses/[slug]/lessons/[lessonId]/quiz/page.tsx](app/(main)/courses/%5Bslug%5D/lessons/%5BlessonId%5D/quiz/page.tsx) | Question/options RTL | `(main)/loading.tsx` | Radio/checkbox groups `role="radiogroup"`, timer announced if `timeLimit` set | P0 |
| PG-017 | Quiz result | [app/(main)/courses/[slug]/lessons/[lessonId]/quiz/result/page.tsx](app/(main)/courses/%5Bslug%5D/lessons/%5BlessonId%5D/quiz/result/page.tsx) | Pass/fail badge RTL | `(main)/loading.tsx` | Score announced, retry button focus | P1 |
| PG-018 | Certificate view | [app/(main)/certificates/[certificateId]/page.tsx](app/(main)/certificates/%5BcertificateId%5D/page.tsx) | Certificate layout mirrors for `ar` | `(main)/loading.tsx` | Print/PDF export accessible name | P1 |
| PG-019 | Public certificate verify | [app/(main)/verify/[certificateNo]/page.tsx](app/(main)/verify/%5BcertificateNo%5D/page.tsx) | RTL | `(main)/loading.tsx` | Invalid cert state doesn't leak stack trace (no error.tsx) | **P0** |
| PG-020 | Live class room | [app/(main)/live/[classId]/page.tsx](app/(main)/live/%5BclassId%5D/page.tsx) | Chat/participant panel mirrors | `(main)/loading.tsx` — **no skeleton while LiveKit token/room is provisioning** | Mic/cam toggle keyboard-accessible, connection-lost state has no fallback UI (BUG-034) | **P0** |
| PG-021 | Pricing | [app/(main)/pricing/page.tsx](app/(main)/pricing/page.tsx) | RTL | `(main)/loading.tsx` | Plan comparison table `<th scope>` | P2 |
| PG-022 | Contact | [app/(main)/contact/page.tsx](app/(main)/contact/page.tsx) | RTL | `(main)/loading.tsx` | Form validation messages | P2 |
| PG-023 | Student dashboard | [app/(main)/student/page.tsx](app/(main)/student/page.tsx) | RTL | `student/loading.tsx` | Stat cards readable order | P1 |
| PG-024 | Student courses | [app/(main)/student/courses/page.tsx](app/(main)/student/courses/page.tsx) | RTL | `student/loading.tsx` | Progress bars `aria-valuenow` | P1 |
| PG-025 | Student certificates | [app/(main)/student/certificates/page.tsx](app/(main)/student/certificates/page.tsx) | RTL | `student/loading.tsx` | — | P2 |
| PG-026 | Student purchases | [app/(main)/student/purchases/page.tsx](app/(main)/student/purchases/page.tsx) | RTL, currency formatting | `student/loading.tsx` | Table headers scoped | P2 |
| PG-027 | Student wishlist | [app/(main)/student/wishlist/page.tsx](app/(main)/student/wishlist/page.tsx) | RTL | `student/loading.tsx` | Remove-button labeled per item (not generic "×") | P2 |
| PG-028 | Student live | [app/(main)/student/live/page.tsx](app/(main)/student/live/page.tsx) | RTL | `student/loading.tsx` | — | P2 |
| PG-029 | Student profile | [app/(main)/student/profile/page.tsx](app/(main)/student/profile/page.tsx) | RTL | `student/loading.tsx` | Avatar upload accessible | P2 |
| PG-030 | Student settings | [app/(main)/student/settings/page.tsx](app/(main)/student/settings/page.tsx) | RTL | `student/loading.tsx` | Password change form | P2 |
| PG-031 | Instructor dashboard | [app/(main)/instructor/page.tsx](app/(main)/instructor/page.tsx) | RTL | `instructor/loading.tsx` | Charts have text-table alternative | P1 |
| PG-032 | Instructor analytics | [app/(main)/instructor/analytics/page.tsx](app/(main)/instructor/analytics/page.tsx) | RTL, chart mirroring (many chart libs don't auto-flip) | `instructor/loading.tsx` | Chart color contrast, non-color-only encoding | P1 |
| PG-033 | Instructor courses | [app/(main)/instructor/courses/page.tsx](app/(main)/instructor/courses/page.tsx) | RTL | `instructor/loading.tsx` | Status badges have text not just color | P1 |
| PG-034 | Instructor course create | [app/(main)/instructor/courses/create/page.tsx](app/(main)/instructor/courses/create/page.tsx) | RTL form | `instructor/loading.tsx` | Multi-step form focus management | P1 |
| PG-035 | Instructor course editor | [app/(main)/instructor/courses/[courseId]/edit/page.tsx](app/(main)/instructor/courses/%5BcourseId%5D/edit/page.tsx) | RTL, drag-reorder mirrors | `instructor/loading.tsx` | Drag-and-drop chapter/lesson reorder must have keyboard alternative | **P1** |
| PG-036 | Instructor earnings | [app/(main)/instructor/earnings/page.tsx](app/(main)/instructor/earnings/page.tsx) | RTL currency | `instructor/loading.tsx` | Withdrawal dialog focus trap | P1 |
| PG-037 | Instructor withdrawals | [app/(main)/instructor/withdrawals/page.tsx](app/(main)/instructor/withdrawals/page.tsx) | RTL | `instructor/loading.tsx` | Status history table | P1 |
| PG-038 | Instructor live | [app/(main)/instructor/live/page.tsx](app/(main)/instructor/live/page.tsx) | RTL | `instructor/loading.tsx` | Schedule dialog date-picker locale-aware (Hijri/Gregorian) | P2 |
| PG-039 | Instructor messages | [app/(main)/instructor/messages/page.tsx](app/(main)/instructor/messages/page.tsx) | RTL chat bubbles align correctly | `instructor/loading.tsx` — **no reconnect UI if Socket.IO drops** | Unread badge announced, message list `aria-live="polite"` | P1 |
| PG-040 | Instructor reviews | [app/(main)/instructor/reviews/page.tsx](app/(main)/instructor/reviews/page.tsx) | RTL | `instructor/loading.tsx` | Star rating has numeric equivalent for SR | P2 |
| PG-041 | Instructor students | [app/(main)/instructor/students/page.tsx](app/(main)/instructor/students/page.tsx) | RTL | `instructor/loading.tsx` | Table sortable headers | P2 |
| PG-042 | Instructor settings | [app/(main)/instructor/settings/page.tsx](app/(main)/instructor/settings/page.tsx) | RTL | `instructor/loading.tsx` | Payment method form PCI-sensitive fields not autofilled insecurely | P1 |
| PG-043 | Admin dashboard | [app/(main)/admin/page.tsx](app/(main)/admin/page.tsx) | RTL | `admin/loading.tsx` | Overview stat tiles | P1 |
| PG-044 | Admin analytics | [app/(main)/admin/analytics/page.tsx](app/(main)/admin/analytics/page.tsx) | RTL | `admin/loading.tsx` | Same chart caveats as PG-032 | P1 |
| PG-045 | Admin courses | [app/(main)/admin/courses/page.tsx](app/(main)/admin/courses/page.tsx) | RTL | `admin/loading.tsx` | Approve/reject dialog focus trap | P0 |
| PG-046 | Admin categories | [app/(main)/admin/categories/page.tsx](app/(main)/admin/categories/page.tsx) | RTL, nested category tree mirrors | `admin/loading.tsx` | Tree expand/collapse keyboard | P2 |
| PG-047 | Admin coupons | [app/(main)/admin/coupons/page.tsx](app/(main)/admin/coupons/page.tsx) | RTL | `admin/loading.tsx` | Create form validation | P1 |
| PG-048 | Admin instructors | [app/(main)/admin/instructors/page.tsx](app/(main)/admin/instructors/page.tsx) | RTL | `admin/loading.tsx` | — | P2 |
| PG-049 | Admin users | [app/(main)/admin/users/page.tsx](app/(main)/admin/users/page.tsx) | RTL | `admin/loading.tsx` | Role-change confirm dialog (irreversible action) | **P0** |
| PG-050 | Admin payments | [app/(main)/admin/payments/page.tsx](app/(main)/admin/payments/page.tsx) | RTL, currency/date formatting | `admin/loading.tsx` | Large table virtualization/pagination performance | P1 |
| PG-051 | Admin reviews | [app/(main)/admin/reviews/page.tsx](app/(main)/admin/reviews/page.tsx) | RTL | `admin/loading.tsx` | — | P2 |
| PG-052 | Admin withdrawals | [app/(main)/admin/withdrawals/page.tsx](app/(main)/admin/withdrawals/page.tsx) | RTL | `admin/loading.tsx` | Approve/reject with amount double-confirmation | **P0** |
| PG-053 | Admin notifications | [app/(main)/admin/notifications/page.tsx](app/(main)/admin/notifications/page.tsx) | RTL | `admin/loading.tsx` | — | P2 |
| PG-054 | Admin settings | [app/(main)/admin/settings/page.tsx](app/(main)/admin/settings/page.tsx) | RTL | `admin/loading.tsx` | Commission-rate change affects future webhook calcs — needs a "this affects future purchases only" notice | P1 |

### 3.18 API Route Coverage Matrix & Orphaned Endpoints (new finding)

كل ملف `route.ts` تحت `app/api/**` (63 ملفًا) تمت مطابقته مع حالات §3.1–§3.16. الفجوات الحقيقية المكتشفة:

| Test ID | Route | Coverage | Note |
|---|---|---|---|
| API-001 | [app/api/messages/[partnerId]/route.ts](app/api/messages/%5BpartnerId%5D/route.ts) | **Gap — add test** | Must verify only sender/recipient can read thread (maps to SEC-IDOR-04, previously undocumented as a real route) |
| API-002 | [app/api/messages/students/route.ts](app/api/messages/students/route.ts) | **Gap — add test** | Instructor-only: must not leak students of other instructors |
| API-003 | [app/api/user/notifications/route.ts](app/api/user/notifications/route.ts) | **Gap — add test** | User must only see own notifications |
| API-004 | [app/api/user/password/route.ts](app/api/user/password/route.ts) | **Gap — add test** | Must require current password before change; rate-limit recommended (currently not in the 3-route rate-limit list) |
| API-005 | [app/api/user/profile/route.ts](app/api/user/profile/route.ts) | **Gap — add test** | Verify role/id fields are not client-writable (mass-assignment) |
| API-006 | [app/api/live/route.ts](app/api/live/route.ts) + [[classId]/route.ts](app/api/live/%5BclassId%5D/route.ts) + [/end](app/api/live/%5BclassId%5D/end/route.ts) | **Gap — add test** | `end` must be instructor/host-only (mirrors LIVE-002 pattern) |
| API-007 | [app/api/courses/[courseId]/reviews/route.ts](app/api/courses/%5BcourseId%5D/reviews/route.ts) | **Gap — add test** | Maps to new REL-014; verify enrollment required, one review per user per course |
| API-008 | [app/api/instructor/payment-methods/route.ts](app/api/instructor/payment-methods/route.ts) | **Gap — add test** | Sensitive payout details — must never be readable by another instructor or student |
| API-009 | [app/api/instructor/courses/[courseId]/publish/route.ts](app/api/instructor/courses/%5BcourseId%5D/publish/route.ts) | Covered by INST-011/012 | — |
| API-010 | [app/api/admin/categories/**](app/api/admin/categories) | **Gap — add test** | Delete-with-children behavior maps to REL-013 |
| API-011 | [app/api/admin/notifications/**](app/api/admin/notifications) | **Gap — add test** | Admin-only broadcast; verify non-admin 403 |
| **DUP-001** (RESOLVED — BUG-033) | ~~`app/api/quizzes/[lessonId]/attempt/route.ts`~~ + ~~`components/quiz/quiz-player.tsx`~~ | **Fixed** | Two independent, divergent quiz-submission implementations existed. Only `quiz/start`+`quiz/submit` was reachable from the UI ([quiz-client.tsx](components/quiz/quiz-client.tsx), used by [PG-016](app/(main)/courses/%5Bslug%5D/lessons/%5BlessonId%5D/quiz/page.tsx)). `quizzes/[lessonId]/attempt` backed the never-imported `QuizPlayer` component and diverged in behavior (no certificate auto-issue on 100% completion). Both the dead component and the orphaned route were deleted after confirming zero references anywhere in the codebase. `app/api/quizzes/[lessonId]/route.ts` (GET/POST/DELETE) was kept — its POST handler is live, used by [quiz-editor.tsx](components/quiz/quiz-editor.tsx) for instructor quiz authoring. | — |
| **DUP-002** (RESOLVED — BUG-035) | ~~`app/api/progress/[lessonId]/route.ts`~~ | **Fixed** | `progress/lesson` (POST) + `progress/course/[courseId]` (GET) remain the live pair, called from [course-video-player.tsx](components/learn/course-video-player.tsx) / [course-sidebar.tsx](components/learn/course-sidebar.tsx). The orphaned `progress/[lessonId]` (PATCH+GET, client-supplied `enrollmentId`) was unreferenced anywhere in the UI and has been deleted. | — |

---

## 4. E2E User Journeys

### Journey #1 — Student buys course with coupon → completes → gets certificate (**GOLDEN PATH**)
1. Register user (STUDENT default role) → verify email
2. Login → browse `/courses`
3. Filter by category → open course detail
4. Apply coupon code `WELCOME20` → validate returns discount
5. Click "Buy now" → Stripe test card `4242 4242 4242 4242`
6. Webhook fires → Purchase + Enrollment created atomically
7. Redirect to `/learn` → first lesson auto-selected
8. Watch all lessons → progress increments → each hits 90% → auto-complete
9. Enrollment.progress reaches 100 → isCompleted=true
10. Take quiz for lesson with quiz → server grades → score saved
11. Request certificate → grade computed → certificateNo issued
12. Visit `/verify/${certificateNo}` publicly → shows valid + details

**Expected assertions:**
- `Purchase.discountAmount > 0`
- `Purchase.platformShare + Purchase.instructorShare = amount`
- `InstructorProfile.pendingEarnings += Purchase.instructorShare` (once, not twice)
- Certificate grade = avg best quiz attempts
- Verify page rate-limited (5/min)

### Journey #2 — Instructor creates course, publishes, receives payment, withdraws
1. Instructor login → `/instructor`
2. Create course (title, category, price) → status=DRAFT
3. Add chapter → add lesson (video URL + isPublished=true)
4. Submit for review → status=PENDING_REVIEW
5. Admin approves → status=PUBLISHED + publishedAt set + notification sent
6. Student buys → webhook credits `pendingEarnings`
7. Instructor requests withdrawal (amount ≤ pendingEarnings) → atomic decrement + status=PENDING
8. Admin approves → status=APPROVED
9. Admin marks COMPLETED → `paidEarnings += amount`
10. Instructor tries second concurrent withdrawal that would go negative → rejected

### Journey #3 — Live session
1. Instructor schedules live class attached to a course
2. Enrolled student sees it in `/student/live`
3. Instructor starts → LiveKit room created, host token issued
4. Student joins → student token (canSubscribe only)
5. Non-enrolled student attempts join → 403
6. Class ends → status=ENDED, recording (if configured)

### Journey #4 — Failure & recovery
1. Student initiates checkout
2. Stripe webhook fires but network drops before response
3. Stripe retries with same `event.id`
4. Idempotency check → skip → 200 (no double Purchase)
5. Student receives one email, one Enrollment

### Journey #5 — Admin cancels a coupon
1. Coupon `X` used by 3 users
2. Admin deletes coupon
3. Prisma `onDelete: SetNull` on Purchase.couponId → Purchases keep records with couponId=null (no orphans, no cascade delete)

---

## 5. Security Test Cases (Penetration-style)

### 5.1 IDOR / Authorization
| SEC-ID | Attack | Mitigation Expected |
|---|---|---|
| SEC-IDOR-01 | Instructor A calls `PATCH /api/instructor/courses/${courseIdOfB}` | 403 — ownership by instructorId |
| SEC-IDOR-02 | Student calls `POST /api/progress/lesson` for lesson in course they didn't buy | 403 — enrollment check |
| SEC-IDOR-03 | Non-host tries `/api/live/${classId}/start` | 403 |
| SEC-IDOR-04 | User A reads user B's messages via `/api/messages/${b}` | 403 — sender/recipient check |
| SEC-IDOR-05 | Certificate download of another user | 403 — ownership |
| SEC-IDOR-06 | Read another user's message thread via `GET /api/messages/${otherUserPairId}` | 403 — sender/recipient check (API-001, previously untested) |
| ~~SEC-IDOR-07~~ | ~~Call orphaned `PATCH /api/progress/{lessonId}` with a forged `enrollmentId`~~ | **N/A — route deleted** (BUG-035/DUP-002 resolved) |

### 5.2 Injection
| SEC-ID | Attack | Mitigation Expected |
|---|---|---|
| SEC-INJ-01 | XSS in course description | DOMPurify sanitizes |
| SEC-INJ-02 | XSS in review comment | Escaped by React |
| SEC-INJ-03 | SQL injection via coupon code | Prisma parameterized queries |
| SEC-INJ-04 | Prototype pollution via payment metadata | JSON.parse safe, no `__proto__` merging |

### 5.3 Rate Limiting
| SEC-ID | Attack | Expected |
|---|---|---|
| SEC-RL-01 | 100 register requests / minute | 429 after N |
| SEC-RL-02 | 100 forgot-password / minute | 429 |
| SEC-RL-03 | 100 verify/${cn} / minute | 429 |
| SEC-RL-04 | 100 quiz submit / minute | Recommendation: add rate limit |

### 5.4 Authentication
| SEC-ID | Attack | Expected |
|---|---|---|
| SEC-AUTH-01 | JWT with `role=ADMIN` forged | Rejected (signature invalid) |
| SEC-AUTH-02 | Socket handshake with random userId | Disconnect |
| SEC-AUTH-03 | Session cookie reuse across users | Independent JWTs |
| SEC-AUTH-04 | Password reset token reuse | 400 second attempt |
| SEC-AUTH-05 | Open redirect via callbackUrl | Same-origin enforced |

### 5.5 Business logic abuse
| SEC-ID | Attack | Expected |
|---|---|---|
| SEC-BIZ-01 | Race two coupon uses at exactly maxUses | Only one succeeds |
| SEC-BIZ-02 | Race two withdrawals draining pendingEarnings | Only one succeeds, other 400 |
| SEC-BIZ-03 | Client sends negative amount to `/api/payments/create` | Rejected (server uses DB) |
| SEC-BIZ-04 | Modify locale cookie to invalid value | Falls back to `ar` |
| SEC-BIZ-05 | Free-course price change loophole | Documented (P2) |

---

## 6. Regression Test Suite (Post-fix)

قصير جدًا؛ يُشغَّل بعد أي تعديل يمس التدفقات المالية أو الأمن.

**RS-01 (Payment):** Journey #1 كامل + assertion `Purchase.instructorShare + platformShare == amount`.  
**RS-02 (Idempotency):** إرسال webhook مرتين → Purchase واحد.  
**RS-03 (Coupon):** كوبون منتهي يُرفض، وscipy race مع maxUses=1.  
**RS-04 (Withdrawal atomic):** 3 requests متزامنة على balance=50 كل واحد 30 → واحد فقط ينجح.  
**RS-05 (Socket auth):** Connect بلا JWT → disconnect.  
**RS-06 (Middleware):** Student يزور `/admin` → redirect.  
**RS-07 (Quiz integrity):** Student يرسل `{score:100}` → مُتجاهَل.  
**RS-08 (Certificate rate limit):** 6/min verify → 429.  
**RS-09 (Type safety):** `tsc --noEmit` = 0 errors.  
**RS-10 (RTL/i18n):** locale=ar → dir="rtl" + `ms-*` present.
**RS-11 (Orphaned routes, RESOLVED):** the two orphaned routes (`quizzes/{lessonId}/attempt`, `progress/{lessonId}`) were deleted rather than kept — confirm they now 404 at the framework level, and re-run a repo-wide "unreferenced API route" sweep after any future refactor touching quiz/progress models so new dead surface doesn't accumulate.
**RS-12 (Error resilience, RESOLVED):** force-throw on checkout/live/learn and confirm the localized `app/error.tsx` renders instead of Next's default page; force a bad slug/certificate number and confirm `app/not-found.tsx` renders.
**RS-13 (Quiz rate limiting, RESOLVED):** 21 rapid calls to `quiz/start` or `quiz/submit` from the same user within 60s → the 21st returns 429.
**RS-14 (i18n, RESOLVED):** re-run the `ar.json` vs `en.json` key-diff script — expect 0 missing keys. Re-run after any future addition to `messages/ar.json` to catch new drift immediately.

---

## 7. Automated Test Recommendations

### 7.1 Layer strategy
| Layer | Tool | Coverage target |
|---|---|---|
| Unit (utils, helpers) | **Vitest** أو Jest | 80% for `lib/**` |
| API routes | **Vitest** + `supertest` + Prisma test DB | 90% for `app/api/**` |
| Component | **Vitest** + React Testing Library | 60% لمكوّنات صفحات critical |
| E2E | **Playwright** | كل journey في §4 |
| Security | **OWASP ZAP** scheduled scan + custom Playwright abuse cases | كل §5 |

### 7.2 CI pipeline (GitHub Actions مثال)
```yaml
name: ci
on: [pull_request, push]
jobs:
  quality:
    steps:
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit             # baseline: 0 errors
      - run: npm run lint
      - run: npm test -- --coverage
  e2e:
    services: [postgres, stripe-cli]
    steps:
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
  security:
    steps:
      - run: npx audit-ci --high
      - uses: aquasecurity/trivy-action@master
```

### 7.2b Implemented: full-app Playwright smoke suite

**Status: implemented and passing (70/70) as of v1.3.** Located at [tests/e2e/](tests/e2e) — `helpers.ts` (login + page-inspection utilities), `public.spec.ts` (16 guest pages), `student.spec.ts` (13 pages), `instructor.spec.ts` (14 pages), `admin.spec.ts` (13 pages), `api.spec.ts` (14 API/security/rate-limit checks). Run with:
```bash
npx playwright test              # full suite
npx playwright test tests/e2e/admin.spec.ts   # one role
```
Each page visit asserts: no uncaught JS exception (`pageerror`), HTTP status < 500, and logs any `console.error` output for review (does not hard-fail on console noise from expected dev-environment gaps like LiveKit/Socket.IO not being configured, but does fail on `MISSING_MESSAGE`/`FORMATTING_ERROR` style bugs since those indicate real broken UI text). Uses seeded accounts (`admin@elearning.com` / `ahmed@elearning.com` / `student@elearning.com`, see [prisma/seed.ts](prisma/seed.ts)) and real DB-derived IDs, not mocks — this is what caught BUG-036/037/038, which no amount of static code reading found.

### 7.3 Priority automation
1. **P0:** RS-01 through RS-05 as Playwright specs (block PR merge on fail).
2. **P0:** Webhook idempotency test with Stripe CLI `stripe listen` + replay.
3. **P1:** Snapshot test for RTL class presence in critical components.
4. **P1:** Contract tests for Prisma schema drift (fail if TS errors > 0).
5. **P2:** Visual regression (Percy / Chromatic) for `/courses`, `/student`, `/instructor`.

### 7.4 Example Playwright spec (PAY-002 idempotency)
```ts
test('webhook idempotency', async ({ request }) => {
  const event = buildStripeEvent()
  const first = await request.post('/api/webhooks/stripe', { data: event, headers: sig(event) })
  const second = await request.post('/api/webhooks/stripe', { data: event, headers: sig(event) })
  expect(first.status()).toBe(200)
  expect(second.status()).toBe(200)
  const purchases = await db.purchase.count({ where: { providerId: event.data.object.payment_intent.id } })
  expect(purchases).toBe(1)
})
```

---

## 8. Bug Report Template + Critical Bugs Found

### 8.1 Template
```
### Bug ID: BUG-XXX
- Title: <short>
- Severity: P0 | P1 | P2 | P3
- Environment: dev | staging | prod
- Affected files: [path/to/file.ts](path/to/file.ts)
- Reproduction:
  1. ...
  2. ...
- Expected: ...
- Actual: ...
- Console/logs: ...
- Screenshot / video: ...
- Suggested fix: ...
- Related test case: PAY-002
```

### 8.2 Critical Bugs Found in Audit (Status)

| Bug ID | Severity | File | Description | Status | Fix |
|---|---|---|---|---|---|
| BUG-001 | P0 | [app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts) | `db.user.update({data:{balance}})` — `balance` doesn't exist on User → webhook crashes on every payment | **FIXED** | Use `instructorProfile.pendingEarnings` |
| BUG-002 | P0 | webhook | `course.title` doesn't exist (schema: `titleEn`/`titleAr`) → email template crash | **FIXED** | Use `course.titleEn` |
| BUG-003 | P0 | webhook | `transactionId: session.payment_intent as string` — payment_intent is an object → stored as `[object Object]` | **FIXED** | Use `providerId: session.payment_intent?.id` |
| BUG-004 | P0 | payments/create + coupons/validate | Query uses `expiresAt` but schema field is `expiryDate` → expired coupons never rejected | **FIXED** | Renamed to `expiryDate` everywhere |
| BUG-005 | P0 | payments/create | `db.coupon.fields.maxUses` is invalid Prisma → coupon validation crashes | **FIXED** | Direct `usedCount >= maxUses` check |
| BUG-006 | P0 | payments/create | Hardcoded 20% commission ignoring admin settings + instructorProfile.commissionRate | **FIXED** | Reads `instructorProfile.commissionRate` |
| BUG-007 | P0 | [pages/api/socket/io.ts](pages/api/socket/io.ts) | `userId` from handshake without JWT verification — spoofable | **FIXED** | JWT verified via `getToken` |
| BUG-008 | P0 | webhook | No idempotency → Stripe retries create duplicate Purchase + double instructor payment | **FIXED** | Check `providerId` before insert + $transaction |
| BUG-009 | P0 | webhook | Purchase + Enrollment + earnings not atomic → partial state on crash | **FIXED** | `db.$transaction(...)` |
| BUG-010 | P0 | [app/api/instructor/withdrawals/route.ts](app/api/instructor/withdrawals/route.ts) | Read-then-update balance → race condition → negative balance possible | **FIXED** | `updateMany({where:{pendingEarnings:{gte:amount}}})` |
| BUG-011 | P0 | withdrawals | Funds deducted immediately on PENDING; if REJECTED they stay lost | **FIXED** | Restore on REJECTED; move to paidEarnings only on COMPLETED |
| BUG-012 | P1 | [app/api/certificates/verify/[certificateNo]/route.ts](app/api/certificates/verify/%5BcertificateNo%5D/route.ts) | Public + no rate limit → enumerate certificates | **FIXED** | `lib/rate-limit.ts` applied 5/min per IP |
| BUG-013 | P1 | auth/register, auth/forgot-password | No rate limit → brute force / spam | **FIXED** | Rate limit applied |
| BUG-014 | P0 | [app/api/upload/route.ts](app/api/upload/route.ts) | MIME check only → spoofable | **FIXED** | `sharp().metadata()` validates real image |
| BUG-015 | P1 | courses/[slug]/page + learn/course-content | `dangerouslySetInnerHTML` unsanitized → stored XSS | **FIXED** | DOMPurify |
| BUG-016 | P0 | [app/(main)/instructor/layout.tsx](app/(main)/instructor/layout.tsx) | Client-side auth check → data flash + potential leak | **FIXED** | Converted to server component |
| BUG-017 | P0 | forgot/reset/validate-reset-token routes | Uses `resetToken`/`resetTokenExpiry` on User model — those fields don't exist. Schema has `PasswordResetToken` model | **FIXED** | Rewritten to use `PasswordResetToken` |
| BUG-018 | P1 | reviews route | Uses non-existent `status` field on Review + broken `_count: true` aggregate | **FIXED** | Removed `status`, `_count: { _all: true }` |
| BUG-019 | P0 | student/purchases | Uses `db.payment` (not a model) instead of `db.purchase` | **FIXED** | Renamed |
| BUG-020 | P1 | instructor publish | Uses `lesson.duration` (not in schema) | **FIXED** | `videoDuration` |
| BUG-021 | P1 | LiveKit calls | `generateToken` returns Promise in new SDK but was called sync | **FIXED** | `await generateToken(...)` |
| BUG-022 | P0 | duplicate learn route | `learn/[lessonId]` + `learn/[[...lessonId]]` = Next.js sibling conflict | **FIXED** | Deleted `[lessonId]` + old components |
| BUG-023 | P2 | schema | `Purchase.coupon` had no `onDelete` policy — orphan risk | **FIXED** | `onDelete: SetNull` |
| BUG-024 | P2 | schema | `Coupon.course` cascade blocks course deletion when coupons exist | **FIXED** | `onDelete: SetNull` |
| BUG-025 | P2 | next.config.js | `ignoreBuildErrors: true` + `ignoreDuringBuilds: true` hid all bugs above | **FIXED** | Removed both flags |
| BUG-026 | P2 | [messages/en.json](messages/en.json) | 616 keys missing from `messages/en.json` (fell back to Arabic) — entire namespaces (`learn`, `categories`, `instructors`, `pricing`, `settings`) were completely absent from the English file | **FIXED** | Translated and merged all 616 keys; verified 0 remaining diff vs `ar.json` |
| BUG-027 | P2 | schema design | `LiveSession` and `LiveClass` are duplicate models | **Deferred** (by request) | Needs a migration plan proposed and reviewed before execution — data migration is hard to reverse |
| BUG-028 | P2 | enrollment | Free-course → paid loophole (existing users keep access) | **Accepted as intended behavior** (by request) | "Grandfathering" existing access is the deliberate, documented policy — no code change needed |
| BUG-029 | P2 | Subscriptions | `/checkout/subscription` = `// TODO` — no gateway integration | **Deferred** (by request) | Out of scope — full feature build requiring business/product decisions |
| BUG-030 | P2 | Payment gateways | PayPal/Paymob/Tap return 501 stubs | **Deferred** (by request) | Needs real API credentials from each provider |
| BUG-031 | P2 | [lib/reconcile-counters.ts](lib/reconcile-counters.ts), [app/api/admin/reconcile-counters/route.ts](app/api/admin/reconcile-counters/route.ts) | `Course.totalStudents/averageRating/totalReviews`, `InstructorProfile.*Earnings`, `Coupon.usedCount` drift risk (manual updates) | **FIXED** | Implemented a reconciliation function that recomputes every counter from its source-of-truth table and only writes fields that actually drifted. Exposed via an idempotent admin/cron-callable endpoint, scheduled nightly at 03:00 via [vercel.json](vercel.json) (protected by `CRON_SECRET` bearer token, falls back to admin-session auth for manual triggering). **Verified against the real dev DB**: found and corrected 12 genuine drifts on first run (the seed data's hardcoded demo numbers, e.g. `totalStudents: 500` vs. 1 actual enrollment), then a second run confirmed 0 diffs (idempotent) |
| BUG-032 | P2 | Socket.IO | Won't work on Vercel serverless deployment | **Deferred** (by request) | Needs a hosting/service decision (Pusher/Ably vs. dedicated server) before implementation |
| BUG-033 | P2 | ~~`app/api/quizzes/[lessonId]/attempt/route.ts`~~, ~~`components/quiz/quiz-player.tsx`~~ | Two parallel quiz-submission systems existed. `quiz/start`+`quiz/submit` is the live path used by the UI; `quizzes/[lessonId]/attempt` backed `QuizPlayer`, which was never imported anywhere, yet the route was still publicly callable and diverged in behavior (no certificate auto-issue on 100% completion) | **FIXED** | Deleted the dead component and orphaned route entirely (confirmed zero references first) |
| BUG-034 | P1 | [app/error.tsx](app/error.tsx), [app/global-error.tsx](app/global-error.tsx), [app/not-found.tsx](app/not-found.tsx) | No `error.tsx`, `global-error.tsx`, or `not-found.tsx` anywhere in the app. Any thrown Server Component exception or `notFound()` call rendered Next.js's default unstyled English error/404 page — broke RTL/i18n/branding, and on the checkout/live/learn pages left the user with no clear next step after a crash | **FIXED** | Added localized (`errors.*`/`navigation.home` via next-intl), RTL-aware `error.tsx`/`not-found.tsx`; `global-error.tsx` uses a hardcoded bilingual fallback (no provider access at that level) keyed off the `locale` cookie |
| BUG-035 | P2 | ~~`app/api/progress/[lessonId]/route.ts`~~ | Same orphaned-route pattern as BUG-033: this PATCH/GET route was unreferenced by any component (live path is `progress/lesson` + `progress/course/[courseId]`), yet still publicly callable with a client-supplied `enrollmentId` | **FIXED** | Deleted the dead route (confirmed zero references first) |
| BUG-036 | P1 | [messages/ar.json](messages/ar.json), [messages/en.json](messages/en.json) | Live smoke-testing of every page (not just static grep) surfaced **118 more** i18n keys referenced by components but missing from **both** locale files — the original BUG-026 fix only diffed `ar.json` against `en.json`, so it never caught keys missing from `ar.json` itself (the default/source locale). A second wave, `admin.failed`/`admin.refunded` (built via `t(status.toLowerCase())`) and the full `admin.notificationTypeLabels.*` map (built via `` t(`notificationTypeLabels.${type}`) ``), was missed even by a purpose-built static-analysis script because the keys are assembled from runtime expressions, not string literals — only caught by actually rendering the pages | **FIXED** | Added all 120 keys (118 + 2) to both locale files; re-ran the full 70-test Playwright suite afterward and confirmed **zero** `MISSING_MESSAGE` console errors across every page/role |
| BUG-037 | P2 | [components/courses/courses-filter.tsx](components/courses/courses-filter.tsx) | `courses.coursesFound` is defined as `"تم العثور على {count} كورس"` (requires a `{count}` variable) but the call site passed no variables at all and prepended the count manually outside the translation call — produced an `IntlError: FORMATTING_ERROR` on every `/courses` page load | **FIXED** | Changed to `t("coursesFound", { count: totalCourses })`, removed the redundant manual prefix |
| BUG-038 | P2 | ~~`components/quiz/quiz-editor.tsx`~~ | A **third** orphaned quiz-authoring component existed alongside BUG-033's findings — never imported anywhere (the live instructor course editor uses `components/instructor/quiz-editor.tsx` instead). Found while tracing i18n key usage per component | **FIXED** | Deleted the dead component (confirmed zero references first); avoided needing to translate its 12 now-moot `quiz.*` keys |
| BUG-039 | **P0** | [.env](.env) | Local `.env` defined `STRIPE_API_KEY` but every Stripe call site ([lib/payments/stripe.ts](lib/payments/stripe.ts), [app/api/payments/create/route.ts](app/api/payments/create/route.ts), [app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts)) reads `STRIPE_SECRET_KEY` — every checkout/webhook call would crash on `new Stripe(undefined)`, **even with a real key filled in**, because the variable name itself was wrong. Same pattern for LiveKit: `.env` had `NEXT_PUBLIC_LIVEKIT_URL` (never read anywhere in the codebase) while [lib/livekit.ts](lib/livekit.ts) reads plain `LIVEKIT_URL` | **FIXED locally** | Renamed both keys in the local `.env`. **Action required from you**: set `STRIPE_SECRET_KEY` and `LIVEKIT_URL` (not the old names) in your hosting provider's production environment variables — `.env` is gitignored and never deploys |
| BUG-040 | P2 | `components/admin/*-table.tsx`, `components/courses/courses-*.tsx`, `components/instructor/instructor-shell.tsx` | 30 pre-existing `tsc --noEmit` errors (`TS18047`/`TS2345`): `useSearchParams()`/`usePathname()` are typed `... \| null` in this Next.js/TS version, but call sites used them unguarded (`searchParams.get(...)`, `pathname.startsWith(...)`, `router.push(pathname)`). Contradicted the test plan's own "0 TS errors" baseline claim | **FIXED** | Added `?.` optional chaining with sensible fallbacks (`?? false`, `?? ""`) at every call site; `router.push(pathname)` → `router.push(pathname \|\| "/courses")`. `npx tsc --noEmit` now returns clean |
| BUG-041 | P3 | [tests/e2e/helpers.ts](tests/e2e/helpers.ts) | The smoke suite itself was flaky: `waitUntil: "networkidle"` never resolves on pages with recurring background activity (video-progress autosave, Socket.IO reconnect attempts), and 15–20s timeouts were too tight for `next dev`'s on-demand route compilation, causing different tests to fail unpredictably from run to run | **FIXED** | Switched to `waitUntil: "load"`, raised navigation/login timeouts to 45s, added 1 retry in [playwright.config.ts](playwright.config.ts). Re-ran the full suite 3× consecutively after the fix: 70/70 passed every time |

### 8.3 Recommended follow-up test cases (for still-open bugs)
- **T-BUG-028:** After enroll on price=0, admin updates price=100 → verify access stays. Then business decision test: should it revoke?
- **T-BUG-031:** Nightly reconciliation script: `SUM(Purchase.instructorShare where userId=X) === InstructorProfile.totalEarnings` for each instructor.
- **T-BUG-026 (RESOLVED):** re-ran the ar/en key-diff script post-fix — 0 missing keys confirmed. Re-run this script in CI whenever `messages/ar.json` changes, to catch new drift before it reaches 616 keys again.
- **T-BUG-033 (RESOLVED):** the orphaned route was deleted rather than reconciled — `POST /api/quizzes/{lessonId}/attempt` now 404s at the routing level, so the certificate-issuance divergence can no longer be triggered.
- **T-BUG-034 (RESOLVED):** manually verify by throwing inside a Server Component on `/checkout/[slug]`, `/live/[classId]`, and `/courses/[slug]/learn/...` — confirm the new `app/error.tsx` renders (localized, with Retry + Home actions) instead of Next's default screen.

---

## Appendix A — Test Data Fixtures

```ts
// tests/fixtures/users.ts
export const users = {
  admin: { email: 'admin@test.local', password: 'Admin@12345', role: 'ADMIN' },
  instructor: { email: 'inst@test.local', password: 'Inst@12345', role: 'INSTRUCTOR' },
  student: { email: 'stu@test.local', password: 'Stu@12345', role: 'STUDENT' },
}

// tests/fixtures/stripe.ts
export const testCards = {
  success: '4242424242424242',
  insufficientFunds: '4000000000009995',
  requires3DS: '4000002500003155',
  declined: '4000000000000002',
}
```

## Appendix B — Manual smoke script (5 min)
1. Open `/` on ar → check RTL layout + navbar Arabic
2. Switch to en → check LTR
3. Login as student → open a paid course → Stripe test buy → verify enrollment
4. Open lesson → verify progress saves + video plays
5. Login as instructor → check dashboard → check earnings pending increment
6. Login as admin → check payment appears in `/admin/payments`
7. Certificate: complete course quickly → issue → verify page rate-limits after 6

---

**Changelog v1.3:** نُفِّذت خطة الاختبار فعليًا بدلاً من توثيقها فقط. أُضيفت مجموعة اختبارات [Playwright](tests/e2e) حقيقية (70 اختبارًا) تُشغِّل خادم Next.js فعليًا وتزور **كل صفحة** من §3.17 بأربعة أدوار (زائر/طالب/معلم/أدمن) باستخدام بيانات مزروعة فعلية من قاعدة البيانات، وترصد: HTTP status، استثناءات JS غير معالجة، وأخطاء console. **النتيجة: 70/70 نجحت** — لا صفحة تتحطم، والتحكم بالوصول (role-based redirects) يعمل كما هو موثّق، والإصلاحات من v1.2 (rate limiting على الاختبارات، حذف المسارات اليتيمة) تم التحقق منها فعليًا عبر طلبات API حقيقية وليس قراءة كود فقط.

الاختبار الحي كشف عن 3 أخطاء إضافية **لم يكتشفها التحليل الساكن للكود سابقًا** (BUG-036/037/038 أدناه) — دليل على أن الفحص الديناميكي (تشغيل فعلي) يجد فئة مختلفة من الأخطاء عن قراءة الكود وحدها، خصوصًا مفاتيح i18n المبنية ديناميكيًا (`t(status.toLowerCase())`, `` t(`ns.${variable}`) ``) التي لا تُكتشف بالبحث النصي البسيط.

**Changelog v1.4:** أُصلحت كل المشاكل المتبقية القابلة للإصلاح بالكود مباشرة دون الحاجة لقرار عمل أو بيانات اعتماد خارجية: **BUG-039** (حرج — أسماء متغيرات بيئة خاطئة كانت ستعطّل Stripe وLiveKit بالكامل حتى مع مفاتيح حقيقية)، **BUG-040** (30 خطأ TypeScript متعلق بـ null-safety)، **BUG-031** (نُفِّذت مهمة تصحيح العدّادات فعليًا وتحققت من عملها على قاعدة بيانات حقيقية)، و**BUG-041** (إصلاح عدم استقرار مجموعة اختبارات Playwright نفسها). تبقّى مؤجَّلًا بقرار المستخدم: BUG-027 (دمج نموذجي البث)، BUG-029/030 (الاشتراكات وبوابات الدفع الأخرى — تحتاج بيانات اعتماد حقيقية)، BUG-032 (قرار استضافة Socket.IO).

---

**End of Test Plan v1.4**

import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { normalizeEgyptianPhone, sendWhatsApp } from "@/lib/whatsapp"
import { getStudentScope } from "@/lib/reports/child-overview"
import { getReportOptOuts, reportOptOutKey } from "@/lib/reports/parent-links"

const DAY_MS = 24 * 60 * 60 * 1000
export const WEEKLY_TEMPLATE = "weekly_report"
/** A recipient gets at most one report per student in this window. */
export const WEEKLY_IDEMPOTENCY_DAYS = 6

type Lang = "ar" | "en"

export interface WeeklySummary {
  student: { id: string; name: string }
  from: Date
  to: Date
  lessonsCompleted: number
  quizzes: { title: string; titleAr: string | null; score: number; passed: boolean }[]
  attendance: { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number }
  homework: { submitted: number; missing: number; graded: { title: string; score: number; maxScore: number }[] }
  grades: { subject: string; title: string; score: number; maxScore: number }[]
  fees: { count: number; total: number }
  alerts: { title: string }[]
}

/** What the student did in the 7 days before `to`. */
export async function buildWeeklySummary(studentId: string, to = new Date()): Promise<WeeklySummary | null> {
  const from = new Date(to.getTime() - 7 * DAY_MS)
  const student = await db.user.findUnique({ where: { id: studentId }, select: { id: true, name: true } })
  if (!student) return null
  const { groupIds, courseIds } = await getStudentScope(studentId)
  const inWindow = { gte: from, lte: to }

  const [lessonsCompleted, quizzes, attendanceRows, dueAssignments, gradedSubs, grades, fees, alerts] =
    await Promise.all([
      db.progress.count({ where: { userId: studentId, isCompleted: true, completedAt: inWindow } }),
      db.quizAttempt.findMany({
        where: { userId: studentId, completedAt: inWindow },
        orderBy: { completedAt: "asc" },
        take: 10,
        select: { score: true, passed: true, quiz: { select: { title: true, titleAr: true } } },
      }),
      db.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId, session: { startsAt: inWindow } },
        _count: { _all: true },
      }),
      groupIds.length || courseIds.length
        ? db.assignment.findMany({
            where: {
              OR: [
                ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
                ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
              ],
              dueAt: inWindow,
            },
            select: { id: true, submissions: { where: { studentId }, select: { id: true } } },
          })
        : Promise.resolve([]),
      db.assignmentSubmission.findMany({
        where: { studentId, gradedAt: inWindow, score: { not: null } },
        take: 10,
        select: { score: true, assignment: { select: { title: true, maxScore: true } } },
      }),
      db.gradeEntry.findMany({
        where: { studentId, createdAt: inWindow },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { subject: true, title: true, score: true, maxScore: true },
      }),
      db.groupFee.aggregate({ where: { studentId, status: "DUE" }, _sum: { amount: true }, _count: { _all: true } }),
      db.studentAlert.findMany({
        where: { studentId, createdAt: inWindow },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { title: true },
      }),
    ])

  const attendance = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 }
  for (const r of attendanceRows) attendance[r.status] = r._count._all

  return {
    student: { id: student.id, name: student.name?.trim() || "—" },
    from,
    to,
    lessonsCompleted,
    quizzes: quizzes.map((q) => ({ title: q.quiz.title, titleAr: q.quiz.titleAr, score: Math.round(q.score), passed: q.passed })),
    attendance,
    homework: {
      submitted: dueAssignments.filter((a) => a.submissions.length > 0).length,
      missing: dueAssignments.filter((a) => a.submissions.length === 0).length,
      graded: gradedSubs.map((s) => ({ title: s.assignment.title, score: s.score ?? 0, maxScore: s.assignment.maxScore })),
    },
    grades,
    fees: { count: fees._count._all, total: fees._sum.amount ?? 0 },
    alerts,
  }
}

// ---------------------------------------------------------------------------
// Rendering. Outgoing messages are rendered here (not through next-intl) so
// the cron can run outside a request and in the parent's own language.
// ---------------------------------------------------------------------------

const TEXT = {
  ar: {
    title: (n: string) => `التقرير الأسبوعي للطالب ${n}`,
    period: "الفترة",
    lessons: "دروس مكتملة",
    quizzes: "الاختبارات",
    avg: "متوسط",
    passed: "ناجح",
    failed: "لم ينجح",
    attendance: "الحضور",
    present: "حضر",
    late: "متأخر",
    absent: "غائب",
    excused: "بعذر",
    homework: "الواجبات",
    submitted: "سُلّم",
    missing: "لم يُسلّم",
    gradedHw: "درجات الواجبات",
    grades: "درجات جديدة",
    fees: "مصروفات مستحقة",
    currency: "ج.م",
    alerts: "تنبيهات المعلمين",
    none: "لا يوجد",
    quiet: "لا يوجد نشاط مسجل هذا الأسبوع.",
    details: "التفاصيل",
    greeting: (n: string | null) => (n ? `أهلاً ${n}،` : "أهلاً،"),
    footer: "هذه رسالة تلقائية من المنصة. يمكنك إيقاف التقارير من صفحة الإعدادات.",
    subject: (n: string) => `التقرير الأسبوعي: ${n}`,
  },
  en: {
    title: (n: string) => `Weekly report for ${n}`,
    period: "Period",
    lessons: "Lessons completed",
    quizzes: "Quizzes",
    avg: "avg",
    passed: "passed",
    failed: "not passed",
    attendance: "Attendance",
    present: "present",
    late: "late",
    absent: "absent",
    excused: "excused",
    homework: "Homework",
    submitted: "submitted",
    missing: "missing",
    gradedHw: "Homework grades",
    grades: "New marks",
    fees: "Fees due",
    currency: "EGP",
    alerts: "Teacher alerts",
    none: "none",
    quiet: "No activity was recorded this week.",
    details: "Details",
    greeting: (n: string | null) => (n ? `Hello ${n},` : "Hello,"),
    footer: "This is an automatic message from the platform. You can turn reports off in your settings.",
    subject: (n: string) => `Weekly report: ${n}`,
  },
} as const

function fmt(lang: Lang) {
  const loc = lang === "ar" ? "ar-EG" : "en-GB"
  return {
    n: (v: number) => new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(v),
    d: (v: Date) => new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", timeZone: "Africa/Cairo" }).format(v),
  }
}

function hasActivity(s: WeeklySummary) {
  const a = s.attendance
  return (
    s.lessonsCompleted > 0 ||
    s.quizzes.length > 0 ||
    a.PRESENT + a.LATE + a.ABSENT + a.EXCUSED > 0 ||
    s.homework.submitted + s.homework.missing + s.homework.graded.length > 0 ||
    s.grades.length > 0 ||
    s.alerts.length > 0
  )
}

/** Short plain-text message for WhatsApp. */
export function renderWhatsAppText(s: WeeklySummary, lang: Lang, link: string): string {
  const t = TEXT[lang]
  const f = fmt(lang)
  const lines: string[] = [`*${t.title(s.student.name)}*`, `${t.period}: ${f.d(s.from)} - ${f.d(s.to)}`, ""]
  lines.push(`- ${t.lessons}: ${f.n(s.lessonsCompleted)}`)
  if (s.quizzes.length) {
    const avg = s.quizzes.reduce((a, q) => a + q.score, 0) / s.quizzes.length
    lines.push(`- ${t.quizzes}: ${f.n(s.quizzes.length)} (${t.avg} ${f.n(Math.round(avg))}%)`)
    for (const q of s.quizzes.slice(0, 5)) {
      const title = (lang === "ar" && q.titleAr) || q.title
      lines.push(`   • ${title}: ${f.n(q.score)}% ${q.passed ? t.passed : t.failed}`)
    }
  }
  const a = s.attendance
  if (a.PRESENT + a.LATE + a.ABSENT + a.EXCUSED > 0) {
    lines.push(
      `- ${t.attendance}: ${t.present} ${f.n(a.PRESENT)} · ${t.late} ${f.n(a.LATE)} · ${t.absent} ${f.n(a.ABSENT)}` +
        (a.EXCUSED ? ` · ${t.excused} ${f.n(a.EXCUSED)}` : "")
    )
  }
  if (s.homework.submitted + s.homework.missing > 0) {
    lines.push(`- ${t.homework}: ${t.submitted} ${f.n(s.homework.submitted)} · ${t.missing} ${f.n(s.homework.missing)}`)
  }
  for (const g of s.homework.graded.slice(0, 3)) lines.push(`   • ${g.title}: ${f.n(g.score)}/${f.n(g.maxScore)}`)
  if (s.grades.length) {
    lines.push(`- ${t.grades}:`)
    for (const g of s.grades.slice(0, 5)) lines.push(`   • ${g.subject} - ${g.title}: ${f.n(g.score)}/${f.n(g.maxScore)}`)
  }
  if (s.fees.total > 0) lines.push(`- ${t.fees}: ${f.n(s.fees.total)} ${t.currency}`)
  if (s.alerts.length) {
    lines.push(`- ${t.alerts}: ${f.n(s.alerts.length)}`)
    for (const al of s.alerts.slice(0, 3)) lines.push(`   • ${al.title}`)
  }
  if (!hasActivity(s)) lines.push("", t.quiet)
  lines.push("", `${t.details}: ${link}`)
  return lines.join("\n")
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** HTML email with the same content as the WhatsApp text. */
export function renderEmail(s: WeeklySummary, lang: Lang, link: string, recipientName: string | null) {
  const t = TEXT[lang]
  const f = fmt(lang)
  const dir = lang === "ar" ? "rtl" : "ltr"
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${value}</td></tr>`
  const a = s.attendance
  const rows: string[] = [row(t.lessons, f.n(s.lessonsCompleted))]
  if (s.quizzes.length) {
    const items = s.quizzes
      .slice(0, 5)
      .map((q) => `${esc((lang === "ar" && q.titleAr) || q.title)}: ${f.n(q.score)}% (${q.passed ? t.passed : t.failed})`)
      .join("<br>")
    rows.push(row(t.quizzes, items))
  }
  if (a.PRESENT + a.LATE + a.ABSENT + a.EXCUSED > 0) {
    rows.push(
      row(t.attendance, `${t.present} ${f.n(a.PRESENT)} · ${t.late} ${f.n(a.LATE)} · ${t.absent} ${f.n(a.ABSENT)} · ${t.excused} ${f.n(a.EXCUSED)}`)
    )
  }
  if (s.homework.submitted + s.homework.missing > 0) {
    rows.push(row(t.homework, `${t.submitted} ${f.n(s.homework.submitted)} · ${t.missing} ${f.n(s.homework.missing)}`))
  }
  if (s.homework.graded.length) {
    rows.push(row(t.gradedHw, s.homework.graded.map((g) => `${esc(g.title)}: ${f.n(g.score)}/${f.n(g.maxScore)}`).join("<br>")))
  }
  if (s.grades.length) {
    rows.push(
      row(t.grades, s.grades.map((g) => `${esc(g.subject)} - ${esc(g.title)}: ${f.n(g.score)}/${f.n(g.maxScore)}`).join("<br>"))
    )
  }
  rows.push(row(t.fees, s.fees.total > 0 ? `${f.n(s.fees.total)} ${t.currency}` : t.none))
  rows.push(row(t.alerts, s.alerts.length ? s.alerts.map((al) => esc(al.title)).join("<br>") : t.none))

  const html = `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222">
  <p>${esc(t.greeting(recipientName))}</p>
  <h2 style="margin:0 0 4px">${esc(t.title(s.student.name))}</h2>
  <p style="margin:0 0 16px;color:#777">${t.period}: ${f.d(s.from)} - ${f.d(s.to)}</p>
  ${hasActivity(s) ? "" : `<p>${t.quiet}</p>`}
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${rows.join("")}</table>
  <p style="margin:20px 0"><a href="${esc(link)}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">${t.details}</a></p>
  <p style="color:#999;font-size:12px">${t.footer}</p>
</div>`
  return { subject: t.subject(s.student.name), html }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

interface Recipient {
  channel: "WHATSAPP" | "EMAIL"
  to: string
  userId: string | null
  name: string | null
  lang: Lang
  kind: "parent" | "guardian"
}

export interface WeeklyRunResult {
  students: number
  sent: number
  logged: number
  failed: number
  skipped: number
  deliveries: { studentId: string; channel: string; to: string; status: string; kind: string }[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const asLang = (v: string | null | undefined): Lang => (v === "en" ? "en" : "ar")

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "")
}

/**
 * Link included in every report. It carries the student id, which is also
 * how a delivery is matched to its student for the idempotency check.
 */
function reportLink(kind: Recipient["kind"], studentId: string) {
  return kind === "parent"
    ? `${appUrl()}/parent/children/${studentId}`
    : `${appUrl()}/register?role=parent&ref=${studentId}`
}

async function alreadySent(r: Recipient, studentId: string, now: Date) {
  const found = await db.messageDelivery.findFirst({
    where: {
      template: WEEKLY_TEMPLATE,
      channel: r.channel,
      to: r.to,
      status: { not: "FAILED" },
      createdAt: { gte: new Date(now.getTime() - WEEKLY_IDEMPOTENCY_DAYS * DAY_MS) },
      body: { contains: studentId },
    },
    select: { id: true },
  })
  return !!found
}

/**
 * Sends the weekly report for every ACTIVE parent link, and to the guardian
 * contact of students that have no linked parent. Safe to run more than once
 * a week: a recipient gets one report per student every 6 days.
 */
export async function runWeeklyReports(opts: { studentId?: string; now?: Date } = {}): Promise<WeeklyRunResult> {
  const now = opts.now ?? new Date()
  const studentFilter = opts.studentId ? { id: opts.studentId } : {}

  const links = await db.parentLink.findMany({
    where: {
      status: "ACTIVE",
      student: { role: "STUDENT", isBlocked: false, ...studentFilter },
      parent: { isBlocked: false },
    },
    select: {
      studentId: true,
      parent: { select: { id: true, name: true, email: true, phone: true, preferredLanguage: true } },
    },
  })
  const guardians = await db.user.findMany({
    where: {
      ...studentFilter,
      role: "STUDENT",
      isBlocked: false,
      parentLinks: { none: { status: "ACTIVE" } },
      OR: [{ guardianPhone: { not: null } }, { guardianEmail: { not: null } }],
    },
    select: { id: true, guardianName: true, guardianEmail: true, guardianPhone: true, preferredLanguage: true },
  })

  const optOuts = await getReportOptOuts(Array.from(new Set(links.map((l) => l.parent.id))))
  const byStudent = new Map<string, Recipient[]>()
  const add = (studentId: string, r: Recipient) => {
    const list = byStudent.get(studentId) ?? []
    if (!list.some((x) => x.channel === r.channel && x.to === r.to)) list.push(r)
    byStudent.set(studentId, list)
  }

  for (const { studentId, parent } of links) {
    const lang = asLang(parent.preferredLanguage)
    const phone = normalizeEgyptianPhone(parent.phone)
    if (phone && !optOuts.has(reportOptOutKey("whatsapp", parent.id))) {
      add(studentId, { channel: "WHATSAPP", to: phone, userId: parent.id, name: parent.name, lang, kind: "parent" })
    }
    if (parent.email && !optOuts.has(reportOptOutKey("email", parent.id))) {
      add(studentId, { channel: "EMAIL", to: parent.email.toLowerCase(), userId: parent.id, name: parent.name, lang, kind: "parent" })
    }
  }
  for (const g of guardians) {
    const lang = asLang(g.preferredLanguage)
    const phone = normalizeEgyptianPhone(g.guardianPhone)
    if (phone) add(g.id, { channel: "WHATSAPP", to: phone, userId: null, name: g.guardianName, lang, kind: "guardian" })
    const email = g.guardianEmail?.trim().toLowerCase()
    if (email && EMAIL_RE.test(email)) {
      add(g.id, { channel: "EMAIL", to: email, userId: null, name: g.guardianName, lang, kind: "guardian" })
    }
  }

  const result: WeeklyRunResult = { students: 0, sent: 0, logged: 0, failed: 0, skipped: 0, deliveries: [] }

  for (const [studentId, recipients] of Array.from(byStudent.entries())) {
    const pending: Recipient[] = []
    for (const r of recipients) {
      if (await alreadySent(r, studentId, now)) result.skipped++
      else pending.push(r)
    }
    if (pending.length === 0) continue
    const summary = await buildWeeklySummary(studentId, now)
    if (!summary) continue
    result.students++

    for (const r of pending) {
      const link = reportLink(r.kind, studentId)
      let status: string
      if (r.channel === "WHATSAPP") {
        const res = await sendWhatsApp({
          to: r.to,
          text: renderWhatsAppText(summary, r.lang, link),
          template: WEEKLY_TEMPLATE,
          userId: r.userId,
        })
        status = res.status
      } else {
        status = await sendReportEmail(r, summary, link)
      }
      if (status === "SENT") result.sent++
      else if (status === "LOGGED") result.logged++
      else result.failed++
      result.deliveries.push({ studentId, channel: r.channel, to: r.to, status, kind: r.kind })
    }
  }
  return result
}

async function sendReportEmail(r: Recipient, summary: WeeklySummary, link: string): Promise<string> {
  const { subject, html } = renderEmail(summary, r.lang, link, r.name)
  let status = process.env.EMAIL_TRANSPORT === "log" ? "LOGGED" : "SENT"
  let error: string | undefined
  try {
    await sendEmail({ to: r.to, subject, html })
  } catch (e) {
    status = "FAILED"
    error = (e instanceof Error ? e.message : String(e)).slice(0, 500)
  }
  try {
    await db.messageDelivery.create({
      data: { channel: "EMAIL", to: r.to, template: WEEKLY_TEMPLATE, body: html, status, error, userId: r.userId },
    })
  } catch (e) {
    console.error("Failed to record email delivery:", e)
  }
  return status
}

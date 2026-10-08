import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  BookOpen,
  ChevronRight,
  Clock,
  Crown,
  LayoutDashboard,
  MessageCircleQuestion,
  Plus,
  Target,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AvatarName,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  scoreTone,
  toneStyles,
  type Tone,
} from "@/components/shared"
import { SendAlertDialog } from "@/components/instructor/send-alert-dialog"
import { cn, formatPrice, getInitials } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("teacherDashboard")
  return { title: t("title") }
}

interface RankedStudent {
  studentId: string
  name: string | null
  image: string | null
  hasGuardianEmail: boolean
  averageScore: number
  quizzesTaken: number
  quizzesPassed: number
}

/** Same ranking rule as /api/instructor/results: average of best score per quiz. */
async function getRanking(instructorId: string): Promise<RankedStudent[]> {
  const attempts = await db.quizAttempt.findMany({
    where: {
      completedAt: { not: null },
      quiz: { lesson: { chapter: { course: { instructorId } } } },
    },
    select: {
      quizId: true,
      userId: true,
      score: true,
      passed: true,
      user: { select: { id: true, name: true, image: true, guardianEmail: true } },
    },
  })
  const best = new Map<string, { score: number; passed: boolean }>()
  const users = new Map<string, (typeof attempts)[number]["user"]>()
  for (const a of attempts) {
    const key = `${a.userId}:${a.quizId}`
    const prev = best.get(key)
    if (!prev || a.score > prev.score) best.set(key, { score: a.score, passed: a.passed })
    users.set(a.userId, a.user)
  }
  const perStudent = new Map<string, { score: number; passed: boolean }[]>()
  best.forEach((value, key) => {
    const userId = key.slice(0, key.indexOf(":"))
    const list = perStudent.get(userId) ?? []
    list.push(value)
    perStudent.set(userId, list)
  })
  return Array.from(perStudent.entries())
    .map(([userId, scores]) => {
      const user = users.get(userId)!
      const average = scores.reduce((s, x) => s + x.score, 0) / (scores.length || 1)
      return {
        studentId: userId,
        name: user.name,
        image: user.image,
        hasGuardianEmail: !!user.guardianEmail,
        averageScore: Math.round(average * 10) / 10,
        quizzesTaken: scores.length,
        quizzesPassed: scores.filter((x) => x.passed).length,
      }
    })
    .sort((a, b) => b.averageScore - a.averageScore || b.quizzesPassed - a.quizzesPassed)
}

export default async function InstructorDashboard() {
  const session = await auth()
  if (!session?.user?.id) return null
  const instructorId = session.user.id

  const t = await getTranslations("teacherDashboard")
  const locale = await getLocale()
  const isAr = locale === "ar"
  const pick = (ar?: string | null, en?: string | null) => (isAr ? ar || en || "" : en || ar || "")
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })
  const money = (v: number) => (v === 0 ? nf.format(0) : formatPrice(v, "EGP", locale))
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const courseOfInstructor = { course: { instructorId } }
  const questionWhere = {
    lesson: { chapter: { course: { instructorId } } },
    answers: { none: { userId: instructorId } },
  }

  const [
    enrolledStudents,
    totalEnrollments,
    activeSubs,
    profile,
    monthPurchases,
    monthSubscriptions,
    unansweredCount,
    recentQuestions,
    recentEnrollments,
    recentSubscriptions,
    pendingCourses,
    ranking,
  ] = await Promise.all([
    db.enrollment.findMany({ where: courseOfInstructor, select: { userId: true }, distinct: ["userId"] }),
    db.enrollment.count({ where: courseOfInstructor }),
    db.teacherSubscription.findMany({
      where: { instructorId, status: "ACTIVE", endsAt: { gt: now } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    db.instructorProfile.findUnique({
      where: { userId: instructorId },
      select: { subscriptionEnabled: true, monthlyPrice: true, totalEarnings: true },
    }),
    db.purchase.aggregate({
      where: { ...courseOfInstructor, status: "COMPLETED", createdAt: { gte: monthStart } },
      _sum: { instructorShare: true },
    }),
    db.teacherSubscription.aggregate({
      where: { instructorId, status: { in: ["ACTIVE", "EXPIRED"] }, createdAt: { gte: monthStart } },
      _sum: { instructorShare: true },
    }),
    db.question.count({ where: questionWhere }),
    db.question.findMany({
      where: questionWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        user: { select: { name: true, image: true } },
        lesson: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            chapter: { select: { course: { select: { titleAr: true, titleEn: true, slug: true } } } },
          },
        },
      },
    }),
    db.enrollment.findMany({
      where: courseOfInstructor,
      orderBy: { enrolledAt: "desc" },
      take: 6,
      select: {
        id: true,
        enrolledAt: true,
        viaSubscription: true,
        user: { select: { name: true, image: true } },
        course: { select: { titleAr: true, titleEn: true } },
      },
    }),
    db.teacherSubscription.findMany({
      where: { instructorId, status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        student: { select: { name: true, image: true } },
      },
    }),
    db.course.count({ where: { instructorId, status: "PENDING_REVIEW" } }),
    getRanking(instructorId),
  ])

  const monthRevenue = (monthPurchases._sum.instructorShare ?? 0) + (monthSubscriptions._sum.instructorShare ?? 0)
  const classAverage = ranking.length
    ? Math.round((ranking.reduce((s, r) => s + r.averageScore, 0) / ranking.length) * 10) / 10
    : null
  const top = ranking.slice(0, 3)
  const bottom = ranking.length > 3 ? ranking.slice(-Math.min(3, ranking.length - 3)).reverse() : []

  type Activity = {
    id: string
    at: Date
    kind: "enrollment" | "subscription"
    name: string | null
    image: string | null
    detail: string
  }
  const activity: Activity[] = [
    ...recentEnrollments
      .filter((e) => !e.viaSubscription)
      .map((e) => ({
        id: `e-${e.id}`,
        at: e.enrolledAt,
        kind: "enrollment" as const,
        name: e.user.name,
        image: e.user.image,
        detail: t("enrolledIn", { course: pick(e.course.titleAr, e.course.titleEn) }),
      })),
    ...recentSubscriptions.map((s) => ({
      id: `s-${s.id}`,
      at: s.createdAt,
      kind: "subscription" as const,
      name: s.student.name,
      image: s.student.image,
      detail: t("subscribedFor", { amount: money(s.amount) }),
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6)

  const quickActions: { href: string; icon: LucideIcon; label: string; hint: string; tone: Tone }[] = [
    { href: "/instructor/courses/create", icon: Plus, label: t("actionNewCourse"), hint: t("actionNewCourseHint"), tone: "primary" },
    { href: "/instructor/groups", icon: UsersRound, label: t("actionNewGroup"), hint: t("actionNewGroupHint"), tone: "info" },
    { href: "/instructor/results", icon: BellRing, label: t("actionSendAlert"), hint: t("actionSendAlertHint"), tone: "warning" },
    { href: "/instructor/questions", icon: MessageCircleQuestion, label: t("actionAnswer"), hint: t("actionAnswerHint"), tone: "success" },
  ]

  const viewAll = (href: string) => (
    <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
      <Link href={href}>
        {t("viewAll")}
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </Button>
  )

  const studentLine = (r: RankedStudent, i: number, variant: "top" | "bottom") => (
    <li key={r.studentId} className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
          variant === "top"
            ? i === 0
              ? "bg-amber-400/20 text-amber-700 ring-amber-400/40 dark:text-amber-300"
              : "bg-primary/10 text-primary ring-primary/20"
            : "bg-destructive/10 text-destructive ring-destructive/20"
        )}
      >
        {variant === "top" ? i + 1 : <AlertTriangle className="h-3.5 w-3.5" />}
      </span>
      <AvatarName
        size="sm"
        name={r.name}
        image={r.image}
        secondary={t("quizzesPassedOf", { passed: r.quizzesPassed, total: r.quizzesTaken })}
        className="flex-1"
      />
      <span className={cn("shrink-0 text-sm font-bold tabular-nums", toneStyles[scoreTone(r.averageScore)].text)}>
        {nf.format(r.averageScore)}%
      </span>
      {variant === "bottom" && (
        <SendAlertDialog
          iconOnly
          student={{ id: r.studentId, name: r.name, hasGuardianEmail: r.hasGuardianEmail }}
        />
      )}
    </li>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title={t("welcome", { name: session.user.name ?? "" })}
        description={t("subtitle")}
        actions={
          <Button asChild className="gap-2">
            <Link href="/instructor/courses/create">
              <Plus className="h-4 w-4" />
              {t("actionNewCourse")}
            </Link>
          </Button>
        }
      />

      {pendingCourses > 0 && (
        <Link
          href="/instructor/courses"
          className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-warning/15 dark:text-amber-300"
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("pendingCoursesNotice", { count: pendingCourses })}</span>
          <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label={t("statStudents")}
          value={nf.format(enrolledStudents.length)}
          icon={Users}
          hint={t("statStudentsHint", { count: totalEnrollments })}
        />
        <StatCard
          label={t("statSubscribers")}
          value={nf.format(activeSubs.length)}
          icon={Crown}
          tone="info"
          hint={
            profile?.subscriptionEnabled
              ? t("statSubscribersOn", { price: money(profile.monthlyPrice) })
              : t("statSubscribersOff")
          }
        />
        <StatCard
          label={t("statMonthRevenue")}
          value={money(monthRevenue)}
          icon={Wallet}
          tone="success"
          hint={t("statMonthRevenueHint", { total: money(profile?.totalEarnings ?? 0) })}
        />
        <StatCard
          label={t("statAvgScore")}
          value={classAverage === null ? "—" : `${nf.format(classAverage)}%`}
          icon={Target}
          tone={classAverage === null ? "primary" : (scoreTone(classAverage) as Exclude<Tone, "neutral">)}
          hint={t("statAvgScoreHint", { count: ranking.length })}
        />
        <StatCard
          label={t("statUnanswered")}
          value={nf.format(unansweredCount)}
          icon={MessageCircleQuestion}
          tone={unansweredCount > 0 ? "warning" : "success"}
          hint={unansweredCount > 0 ? t("statUnansweredHint") : t("statUnansweredNone")}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="type-h4">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", toneStyles[a.tone].icon)}>
                <a.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.hint}</p>
              </div>
              <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary rtl:-scale-x-100 sm:block" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard
          className="lg:col-span-3"
          icon={MessageCircleQuestion}
          title={t("questionsTitle")}
          description={t("questionsHint")}
          action={viewAll("/instructor/questions")}
          contentClassName="p-0"
        >
          {recentQuestions.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={MessageCircleQuestion}
              title={t("noQuestionsTitle")}
              description={t("noQuestionsHint")}
            />
          ) : (
            <ul className="divide-y">
              {recentQuestions.map((q) => (
                <li key={q.id}>
                  <Link
                    href="/instructor/questions"
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {q.user.image ? <AvatarImage src={q.user.image} alt="" className="object-cover" /> : null}
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(q.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{q.title || q.content}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {q.user.name ?? "—"} · {pick(q.lesson.chapter.course.titleAr, q.lesson.chapter.course.titleEn)} ·{" "}
                        {pick(q.lesson.titleAr, q.lesson.titleEn)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateFmt.format(q.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          icon={UserPlus}
          title={t("activityTitle")}
          description={t("activityHint")}
          action={viewAll("/instructor/students")}
          contentClassName="p-0"
        >
          {activity.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={UserPlus} title={t("noActivity")} />
          ) : (
            <ul className="divide-y">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                  <AvatarName name={a.name} image={a.image} size="sm" secondary={a.detail} className="flex-1" />
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        a.kind === "subscription" ? toneStyles.info.soft : toneStyles.success.soft
                      )}
                    >
                      {a.kind === "subscription" ? <Crown className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                      {a.kind === "subscription" ? t("kindSubscription") : t("kindEnrollment")}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{dateFmt.format(a.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Trophy}
          title={t("topTitle")}
          action={viewAll("/instructor/results")}
          contentClassName="p-0"
        >
          {top.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Trophy} title={t("noResults")} description={t("noResultsHint")} />
          ) : (
            <ul className="divide-y">{top.map((r, i) => studentLine(r, i, "top"))}</ul>
          )}
        </SectionCard>
        <SectionCard
          icon={AlertTriangle}
          title={t("bottomTitle")}
          description={t("bottomHint")}
          action={viewAll("/instructor/results")}
          contentClassName="p-0"
        >
          {bottom.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Target} title={t("noBottom")} />
          ) : (
            <ul className="divide-y">{bottom.map((r, i) => studentLine(r, i, "bottom"))}</ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

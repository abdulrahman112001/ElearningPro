import Link from "next/link"
import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Crown,
  GraduationCap,
  MessageSquareText,
  PlayCircle,
  Sparkles,
  Video,
  Flame,
  Trophy,
  Wallet,
  ClipboardList,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { levelFromPoints } from "@/lib/gamification"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AvatarName,
  EmptyState,
  ScoreBar,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/shared"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return { title: t("dashboard") }
}

export default async function StudentDashboard() {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id

  const t = await getTranslations("studentDashboard")
  const tStudent = await getTranslations("student")
  const tNav = await getTranslations("nav.dashboard")

  // Platform features at a glance: points/level, streak, wallet, homework due
  const [me, pendingHomework] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { points: true, currentStreak: true, walletBalance: true },
    }),
    db.assignment.count({
      where: {
        AND: [
          {
            OR: [
              { group: { members: { some: { studentId: userId } } } },
              { course: { enrollments: { some: { userId } } } },
            ],
          },
          { OR: [{ dueAt: null }, { dueAt: { gte: new Date() } }] },
          { submissions: { none: { studentId: userId } } },
        ],
      },
    }),
  ])
  const level = levelFromPoints(me?.points ?? 0)
  const locale = await getLocale()
  const isAr = locale === "ar"
  const pick = (ar?: string | null, en?: string | null) =>
    (isAr ? ar || en : en || ar) || ""
  const numFmt = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const dateTimeFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const now = new Date()

  const [user, enrollments, completedProgress, certificates, activeSubs, alerts, answers] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          gradeLevelId: true,
          gradeLevel: { select: { nameAr: true, nameEn: true } },
        },
      }),
      db.enrollment.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              titleEn: true,
              thumbnail: true,
              instructorId: true,
              instructor: { select: { name: true, image: true } },
              chapters: { select: { lessons: { select: { id: true } } } },
            },
          },
        },
      }),
      db.progress.findMany({
        where: { userId, isCompleted: true },
        select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
      }),
      db.certificate.count({ where: { userId } }),
      db.teacherSubscription.findMany({
        where: { studentId: userId, status: "ACTIVE", endsAt: { gt: now } },
        select: { instructorId: true },
        distinct: ["instructorId"],
      }),
      db.studentAlert.findMany({
        where: { studentId: userId },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { sender: { select: { name: true, image: true } } },
      }),
      db.answer.findMany({
        where: { question: { userId }, NOT: { userId } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          user: { select: { id: true, name: true, image: true } },
          question: {
            select: {
              title: true,
              lessonId: true,
              lesson: {
                select: {
                  chapter: {
                    select: { course: { select: { slug: true, instructorId: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    ])

  // Completed lessons per course (one query instead of one per course)
  const doneByCourse = new Map<string, number>()
  for (const p of completedProgress) {
    const id = p.lesson.chapter.courseId
    doneByCourse.set(id, (doneByCourse.get(id) ?? 0) + 1)
  }
  const subscribedTeachers = new Set(activeSubs.map((s) => s.instructorId))

  const courses = enrollments.map((e) => {
    const totalLessons = e.course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)
    const completedLessons = Math.min(doneByCourse.get(e.courseId) ?? 0, totalLessons)
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    const lapsed = e.viaSubscription && !subscribedTeachers.has(e.course.instructorId)
    return { ...e, totalLessons, completedLessons, percent, lapsed }
  })

  const completedCount = courses.filter((c) => c.percent === 100 || c.isCompleted).length
  const continueLearning = courses
    .filter((c) => !c.lapsed && c.percent < 100)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)

  const enrolledIds = enrollments.map((e) => e.courseId)

  const [gradeCourses, liveClasses] = await Promise.all([
    user?.gradeLevelId
      ? db.course.findMany({
          where: {
            status: "PUBLISHED",
            gradeLevelId: user.gradeLevelId,
            id: { notIn: enrolledIds },
            OR: [
              { classGroupId: null },
              { classGroup: { members: { some: { studentId: userId } } } },
            ],
          },
          orderBy: [{ totalStudents: "desc" }, { createdAt: "desc" }],
          take: 4,
          select: {
            id: true,
            slug: true,
            titleAr: true,
            titleEn: true,
            thumbnail: true,
            price: true,
            discountPrice: true,
            instructorId: true,
            instructor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    db.liveClass.findMany({
      where: {
        OR: [{ courseId: { in: enrolledIds } }, { courseId: null }],
        AND: [
          {
            OR: [
              { status: "LIVE" },
              { status: "SCHEDULED", scheduledAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
            ],
          },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: {
        instructor: { select: { name: true, image: true } },
        course: { select: { titleAr: true, titleEn: true } },
      },
    }),
  ])

  const firstName = (user?.name ?? session.user.name ?? "").split(" ")[0]
  const gradeName = user?.gradeLevel ? pick(user.gradeLevel.nameAr, user.gradeLevel.nameEn) : null

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("welcomeBack")}
            </p>
            <h1 className="type-h1 break-words">
              {firstName ? t("hello", { name: firstName }) : tStudent("welcome")}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              {t("subtitle")}
            </p>
            {gradeName && (
              <Badge variant="outline" className="gap-1.5 bg-card/60">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                {gradeName}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {continueLearning[0] ? (
              <Button asChild size="lg">
                <Link href={`/courses/${continueLearning[0].course.slug}/learn`}>
                  <PlayCircle aria-hidden="true" />
                  {t("resume")}
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/courses">
                  <BookOpen aria-hidden="true" />
                  {tStudent("browseCourses")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={tStudent("enrolledCourses")}
          value={numFmt.format(enrollments.length)}
          icon={BookOpen}
          tone="primary"
        />
        <StatCard
          label={tStudent("completed")}
          value={numFmt.format(completedCount)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label={tStudent("certificates")}
          value={numFmt.format(certificates)}
          icon={Award}
          tone="warning"
        />
        <StatCard
          label={t("activeSubscriptions")}
          value={numFmt.format(subscribedTeachers.size)}
          icon={Crown}
          tone="info"
        />
      </div>

      {/* Points, streak, wallet and homework */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Link href="/student/achievements" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={tNav("achievements")}
            value={numFmt.format(me?.points ?? 0)}
            hint={tNav("levelShort", { level: numFmt.format(level.level) })}
            icon={Trophy}
            tone="warning"
          />
        </Link>
        <Link href="/student/achievements" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={tNav("streakDays")}
            value={numFmt.format(me?.currentStreak ?? 0)}
            icon={Flame}
            tone="danger"
          />
        </Link>
        <Link href="/student/wallet" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={tNav("wallet")}
            value={numFmt.format(me?.walletBalance ?? 0)}
            hint={tNav("currencyEgp")}
            icon={Wallet}
            tone="success"
          />
        </Link>
        <Link href="/student/homework" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={tNav("homeworkDue")}
            value={numFmt.format(pendingHomework)}
            icon={ClipboardList}
            tone="info"
          />
        </Link>
      </div>

      {/* Continue learning */}
      <SectionCard
        icon={PlayCircle}
        title={tStudent("continueLearning")}
        action={
          enrollments.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/student/courses">
                {tStudent("viewAll")}
                <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      >
        {enrollments.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={BookOpen}
            title={tStudent("noCourses")}
            description={tStudent("noCoursesDescription")}
            action={
              <Button asChild>
                <Link href="/courses">{tStudent("browseCourses")}</Link>
              </Button>
            }
          />
        ) : continueLearning.length === 0 ? (
          <EmptyState
            variant="plain"
            size="sm"
            icon={Award}
            title={t("allCaughtUp")}
            description={t("allCaughtUpDescription")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueLearning.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.course.slug}/learn`}
                className="surface surface-interactive group flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="relative aspect-video bg-muted">
                  {c.course.thumbnail ? (
                    <Image
                      src={c.course.thumbnail}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <PlayCircle className="h-10 w-10 text-primary/50" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <PlayCircle
                      className="h-12 w-12 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                      {pick(c.course.titleAr, c.course.titleEn)}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {c.course.instructor.name}
                    </p>
                  </div>
                  <ScoreBar
                    className="mt-auto"
                    size="sm"
                    neutralTone
                    value={c.completedLessons}
                    max={c.totalLessons || 1}
                    label={t("lessonsProgress", {
                      done: c.completedLessons,
                      total: c.totalLessons,
                    })}
                    valueLabel={`${numFmt.format(c.percent)}%`}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Teacher alerts + answered questions */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            icon={Bell}
            title={t("alertsTitle")}
            description={t("alertsDescription")}
            contentClassName={alerts.length ? "p-0" : undefined}
          >
            {alerts.length === 0 ? (
              <EmptyState
                variant="plain"
                size="sm"
                icon={Bell}
                title={t("noAlerts")}
                description={t("noAlertsDescription")}
              />
            ) : (
              <ul className="divide-y">
                {alerts.map((a) => (
                  <li key={a.id} className="space-y-2 px-4 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <AvatarName
                        size="sm"
                        name={a.sender.name}
                        image={a.sender.image}
                        secondary={dateTimeFmt.format(a.createdAt)}
                      />
                      {a.toGuardian && (
                        <Badge variant="outline" className="shrink-0 font-medium">
                          {t("sentToGuardian")}
                        </Badge>
                      )}
                    </div>
                    <div className="rounded-md border-s-2 border-warning bg-warning/5 px-3 py-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                        {a.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={MessageSquareText}
            title={t("answersTitle")}
            description={t("answersDescription")}
            contentClassName={answers.length ? "p-0" : undefined}
          >
            {answers.length === 0 ? (
              <EmptyState
                variant="plain"
                size="sm"
                icon={MessageSquareText}
                title={t("noAnswers")}
                description={t("noAnswersDescription")}
              />
            ) : (
              <ul className="divide-y">
                {answers.map((a) => {
                  const course = a.question.lesson.chapter.course
                  const isTeacher = a.userId === course.instructorId
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/courses/${course.slug}/learn/${a.question.lessonId}#lesson-questions`}
                        className="block space-y-2 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6"
                      >
                        <AvatarName
                          size="sm"
                          name={a.user.name}
                          image={a.user.image}
                          badge={
                            isTeacher ? (
                              <StatusBadge status="ACTIVE" tone="primary" dot={false} label={t("teacher")} />
                            ) : undefined
                          }
                          secondary={dateFmt.format(a.createdAt)}
                        />
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {t("onQuestion", { title: a.question.title })}
                        </p>
                        <p className="line-clamp-2 text-sm">{a.content}</p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Upcoming live classes */}
        <SectionCard
          icon={Video}
          title={t("liveTitle")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/student/live">{tStudent("viewAll")}</Link>
            </Button>
          }
          contentClassName={liveClasses.length ? "p-0" : undefined}
          className="self-start"
        >
          {liveClasses.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={CalendarClock}
              title={t("noLive")}
              description={t("noLiveDescription")}
            />
          ) : (
            <ul className="divide-y">
              {liveClasses.map((lc) => (
                <li key={lc.id}>
                  <Link
                    href={`/live/${lc.id}`}
                    className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {pick(lc.titleAr, lc.title)}
                      </p>
                      <StatusBadge status={lc.status} />
                    </div>
                    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {dateTimeFmt.format(lc.scheduledAt)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lc.instructor.name}
                      {lc.course ? ` · ${pick(lc.course.titleAr, lc.course.titleEn)}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Courses for your grade */}
      <SectionCard
        icon={GraduationCap}
        title={gradeName ? t("forYourGradeNamed", { grade: gradeName }) : t("forYourGrade")}
        description={t("forYourGradeDescription")}
        action={
          user?.gradeLevelId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/courses?grade=${user.gradeLevelId}`}>
                {tStudent("viewAll")}
                <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      >
        {!user?.gradeLevelId ? (
          <EmptyState
            variant="plain"
            size="sm"
            icon={GraduationCap}
            title={t("setGradeTitle")}
            description={t("setGradeDescription")}
            action={
              <Button asChild size="sm">
                <Link href="/student/profile#grade">{t("setGrade")}</Link>
              </Button>
            }
          />
        ) : gradeCourses.length === 0 ? (
          <EmptyState
            variant="plain"
            size="sm"
            icon={BookOpen}
            title={t("noGradeCourses")}
            description={t("noGradeCoursesDescription")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gradeCourses.map((c) => {
              const price = c.discountPrice ?? c.price
              const included = subscribedTeachers.has(c.instructorId)
              return (
                <Link
                  key={c.id}
                  href={`/courses/${c.slug}`}
                  className="surface surface-interactive group flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="relative aspect-video bg-muted">
                    {c.thumbnail ? (
                      <Image
                        src={c.thumbnail}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <BookOpen className="h-8 w-8 text-primary/50" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                      {pick(c.titleAr, c.titleEn)}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">{c.instructor.name}</p>
                    <div className="mt-auto pt-1">
                      {included ? (
                        <StatusBadge status="ACTIVE" label={t("inSubscription")} />
                      ) : (
                        <span className="text-sm font-bold text-primary">
                          {formatPrice(price, "EGP", locale)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

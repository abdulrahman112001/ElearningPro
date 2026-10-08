import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import Image from "next/image"
import { PlayCircle, Clock, BookOpen, GraduationCap, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, PageHeader, ScoreBar, StatusBadge } from "@/components/shared"
import { formatDuration } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("myCourses"),
  }
}

export default async function StudentCoursesPage() {
  const session = await auth()
  const t = await getTranslations("student")
  const tSub = await getTranslations("subscriptions")
  const common = await getTranslations("common")
  const locale = await getLocale()
  const isAr = locale === "ar"
  const numFmt = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")

  if (!session?.user?.id) return null
  const userId = session.user.id

  // Fetch enrollments
  const [enrollments, completedProgress, activeSubs] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, name: true, image: true },
            },
            category: true,
            chapters: {
              include: {
                lessons: {
                  select: { id: true, videoDuration: true },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    db.progress.findMany({
      where: { userId, isCompleted: true },
      select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
    }),
    db.teacherSubscription.findMany({
      where: { studentId: userId, status: "ACTIVE", endsAt: { gt: new Date() } },
      select: { instructorId: true },
    }),
  ])

  const doneByCourse = new Map<string, number>()
  for (const p of completedProgress) {
    const id = p.lesson.chapter.courseId
    doneByCourse.set(id, (doneByCourse.get(id) ?? 0) + 1)
  }
  const subscribedTeachers = new Set(activeSubs.map((s) => s.instructorId))

  // Calculate progress for each course
  const coursesWithProgress = enrollments.map((enrollment) => {
    const totalLessons = enrollment.course.chapters.reduce(
      (acc, ch) => acc + ch.lessons.length,
      0
    )

    // videoDuration is stored in seconds
    const totalDuration = Math.round(
      enrollment.course.chapters.reduce(
        (acc, ch) =>
          acc + ch.lessons.reduce((a, l) => a + (l.videoDuration || 0), 0),
        0
      ) / 60
    )

    const completedLessons = Math.min(
      doneByCourse.get(enrollment.courseId) ?? 0,
      totalLessons
    )

    const progressPercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0

    const lapsed =
      enrollment.viaSubscription &&
      !subscribedTeachers.has(enrollment.course.instructorId)

    return {
      ...enrollment,
      totalLessons,
      totalDuration,
      completedLessons,
      progressPercentage,
      lapsed,
    }
  })

  const inProgressCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage > 0 && c.progressPercentage < 100
  )
  const completedCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage === 100
  )
  const notStartedCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage === 0
  )

  const pick = (ar?: string | null, en?: string | null) =>
    (isAr ? ar || en : en || ar) || ""

  const CourseCard = ({
    enrollment,
  }: {
    enrollment: (typeof coursesWithProgress)[0]
  }) => {
    const done = enrollment.progressPercentage === 100
    return (
      <article className="surface surface-interactive group flex flex-col overflow-hidden">
        <Link
          href={`/courses/${enrollment.course.slug}`}
          className="relative block aspect-video bg-muted"
          tabIndex={-1}
          aria-hidden="true"
        >
          {enrollment.course.thumbnail ? (
            <Image
              src={enrollment.course.thumbnail}
              alt=""
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <PlayCircle className="h-10 w-10 text-primary/50" />
            </div>
          )}
          <div className="absolute end-2 top-2 flex flex-wrap justify-end gap-1.5">
            {done && (
              <StatusBadge status="COMPLETED" label={t("completed")} className="bg-card/90 backdrop-blur" />
            )}
            {enrollment.viaSubscription && !enrollment.lapsed && (
              <StatusBadge
                status="ACTIVE"
                tone="info"
                label={tSub("viaSubscription")}
                className="bg-card/90 backdrop-blur"
              />
            )}
            {enrollment.lapsed && (
              <StatusBadge
                status="EXPIRED"
                label={tSub("subscriptionExpired")}
                className="bg-card/90 backdrop-blur"
              />
            )}
          </div>
        </Link>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-w-0 space-y-1">
            {enrollment.course.category && (
              <p className="truncate text-xs font-medium text-primary">
                {pick(enrollment.course.category.nameAr, enrollment.course.category.nameEn)}
              </p>
            )}
            <h3 className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
              <Link href={`/courses/${enrollment.course.slug}`}>
                {pick(enrollment.course.titleAr, enrollment.course.titleEn)}
              </Link>
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {enrollment.course.instructor.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {numFmt.format(enrollment.totalLessons)} {t("lessons")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDuration(enrollment.totalDuration, locale)}
            </span>
          </div>

          <ScoreBar
            className="mt-auto"
            size="sm"
            neutralTone={!done}
            tone={done ? "success" : undefined}
            value={enrollment.completedLessons}
            max={enrollment.totalLessons || 1}
            label={`${numFmt.format(enrollment.completedLessons)}/${numFmt.format(enrollment.totalLessons)} ${t("lessonsCompleted")}`}
            valueLabel={`${numFmt.format(enrollment.progressPercentage)}%`}
          />

          {enrollment.lapsed ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/instructors/${enrollment.course.instructor.id}`}>
                <Crown aria-hidden="true" />
                {tSub("renewToContinue")}
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full" variant={done ? "outline" : "default"}>
              <Link href={`/courses/${enrollment.course.slug}/learn`}>
                <PlayCircle aria-hidden="true" />
                {enrollment.progressPercentage === 0
                  ? t("startCourse")
                  : done
                    ? t("reviewCourse")
                    : t("continue")}
              </Link>
            </Button>
          )}
        </div>
      </article>
    )
  }

  const Grid = ({
    items,
    empty,
  }: {
    items: typeof coursesWithProgress
    empty: string
  }) =>
    items.length === 0 ? (
      <EmptyState size="sm" icon={BookOpen} title={empty} />
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((enrollment) => (
          <CourseCard key={enrollment.id} enrollment={enrollment} />
        ))}
      </div>
    )

  const tabs = [
    { value: "all", label: common("all"), count: coursesWithProgress.length },
    { value: "in-progress", label: t("inProgress"), count: inProgressCourses.length },
    { value: "completed", label: t("completed"), count: completedCourses.length },
    { value: "not-started", label: t("notStarted"), count: notStartedCourses.length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title={t("myCourses")}
        description={t("myCoursesDescription")}
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">
              <BookOpen aria-hidden="true" />
              {t("browseCourses")}
            </Link>
          </Button>
        }
      />

      {coursesWithProgress.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("noCourses")}
          description={t("noCoursesDescription")}
          action={
            <Button asChild>
              <Link href="/courses">{t("browseCourses")}</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                    {numFmt.format(tab.count)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-6">
            <Grid items={coursesWithProgress} empty={t("noCourses")} />
          </TabsContent>
          <TabsContent value="in-progress" className="mt-6">
            <Grid items={inProgressCourses} empty={t("noInProgressCourses")} />
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            <Grid items={completedCourses} empty={t("noCompletedCourses")} />
          </TabsContent>
          <TabsContent value="not-started" className="mt-6">
            <Grid items={notStartedCourses} empty={t("noNotStartedCourses")} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

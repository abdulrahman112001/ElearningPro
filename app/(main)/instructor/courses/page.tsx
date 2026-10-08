import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Clock,
  Edit,
  Eye,
  GraduationCap,
  Layers,
  Lock,
  MoreVertical,
  PlayCircle,
  Plus,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/shared"
import { formatPrice } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("myCourses"),
  }
}

export default async function InstructorCoursesPage() {
  const session = await auth()
  const t = await getTranslations("instructor")
  const ta = await getTranslations("a11y")
  const tAud = await getTranslations("courseAudience")
  const locale = await getLocale()
  const isAr = locale === "ar"
  const pick = (ar?: string | null, en?: string | null) => (isAr ? ar || en || "" : en || ar || "")
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")

  if (!session?.user?.id) return null

  const courses = await db.course.findMany({
    where: { instructorId: session.user.id },
    include: {
      category: true,
      gradeLevel: { select: { nameAr: true, nameEn: true } },
      classGroup: { select: { name: true } },
      _count: {
        select: {
          enrollments: true,
          reviews: true,
          chapters: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const published = courses.filter((c) => c.status === "PUBLISHED").length
  const pendingReview = courses.filter((c) => c.status === "PENDING_REVIEW").length
  const totalStudents = courses.reduce((s, c) => s + c._count.enrollments, 0)

  const newCourseButton = (
    <Button asChild className="gap-2">
      <Link href="/instructor/courses/create">
        <Plus className="h-4 w-4" />
        {t("createCourse")}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title={t("myCourses")}
        description={t("myCoursesDescription")}
        actions={newCourseButton}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title={t("noCourses")}
          description={t("noCoursesDescription")}
          action={
            <Button asChild className="gap-2">
              <Link href="/instructor/courses/create">
                <Plus className="h-4 w-4" />
                {t("createFirst")}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label={t("totalCourses")} value={nf.format(courses.length)} icon={BookOpen} />
            <StatCard label={t("published")} value={nf.format(published)} icon={Eye} tone="success" />
            <StatCard label={tAud("pendingReview")} value={nf.format(pendingReview)} icon={Clock} tone="warning" />
            <StatCard label={t("totalStudents")} value={nf.format(totalStudents)} icon={Users} tone="info" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={pick(course.titleAr, course.titleEn)}
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <PlayCircle className="h-12 w-12 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
                    <StatusBadge status={course.status} className="bg-background/90 backdrop-blur" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-background/90 backdrop-blur"
                          aria-label={ta("moreActions")}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/instructor/courses/${course.id}/edit`} className="gap-2">
                            <Edit className="h-4 w-4" />
                            {t("edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/courses/${course.slug}`} className="gap-2">
                            <Eye className="h-4 w-4" />
                            {t("preview")}
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  {course.category && (
                    <p className="text-xs font-medium text-primary">
                      {pick(course.category.nameAr, course.category.nameEn)}
                    </p>
                  )}
                  <h3 className="line-clamp-2 font-semibold leading-snug">{pick(course.titleAr, course.titleEn)}</h3>

                  {(course.gradeLevel || course.classGroup) && (
                    <div className="flex flex-wrap gap-1.5">
                      {course.gradeLevel && (
                        <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          {pick(course.gradeLevel.nameAr, course.gradeLevel.nameEn)}
                        </span>
                      )}
                      {course.classGroup && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-info/20 bg-info/10 px-2 py-0.5 text-[11px] text-info">
                          <Lock className="h-3 w-3" />
                          {course.classGroup.name}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span className="tabular-nums">{nf.format(course._count.enrollments)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      <span className="tabular-nums">{course.averageRating.toFixed(1)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      {nf.format(course._count.chapters)} {t("chapters")}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    <span className="font-bold tabular-nums">
                      {course.price === 0 ? t("free") : formatPrice(course.price, "EGP", locale)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/instructor/courses/${course.id}/edit`}>{t("manage")}</Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

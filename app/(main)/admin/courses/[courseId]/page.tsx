import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowRight, BookOpen, ExternalLink } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDuration, formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PendingReviewActions } from "@/components/admin/pending-review-actions"

/** Admin view of a single course: details, content outline and review actions. */
export default async function AdminCoursePage({
  params,
}: {
  params: { courseId: string }
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/")

  const [t, locale] = await Promise.all([getTranslations("adminCourse"), getLocale()])

  const course = await db.course.findUnique({
    where: { id: params.courseId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      category: { select: { nameAr: true, nameEn: true } },
      chapters: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, titleAr: true, titleEn: true, isPublished: true, videoDuration: true },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  })
  if (!course) notFound()

  const isAr = locale !== "en"
  const title = (isAr ? course.titleAr || course.titleEn : course.titleEn || course.titleAr) || ""
  const description = isAr ? course.descriptionAr || course.descriptionEn : course.descriptionEn || course.descriptionAr
  const lessonCount = course.chapters.reduce((n, ch) => n + ch.lessons.length, 0)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/courses">
          <ArrowRight className="h-4 w-4 me-2 ltr:rotate-180" />
          {t("back")}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={course.status === "PUBLISHED" ? "default" : "secondary"}>
              {t(`statuses.${course.status}`)}
            </Badge>
            <span>
              {t("instructor")}: {course.instructor.name} ({course.instructor.email})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {course.status === "PENDING_REVIEW" && (
            <PendingReviewActions kind="course" id={course.id} />
          )}
          {course.status === "PUBLISHED" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${course.slug}`}>
                <ExternalLink className="h-4 w-4 me-2" />
                {t("viewPublic")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("price")}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatPrice(course.discountPrice ?? course.price, "EGP", locale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("category")}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">
            {course.category ? (isAr ? course.category.nameAr : course.category.nameEn) : "-"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("lessons")}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{lessonCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("students")}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{course._count.enrollments}</CardContent>
        </Card>
      </div>

      {description && (
        <Card>
          <CardHeader><CardTitle>{t("description")}</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-muted-foreground">{description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("content")}</CardTitle></CardHeader>
        <CardContent>
          {course.chapters.length === 0 ? (
            <p className="text-muted-foreground">{t("noContent")}</p>
          ) : (
            <ol className="space-y-4">
              {course.chapters.map((chapter) => (
                <li key={chapter.id}>
                  <p className="font-medium">
                    {isAr ? chapter.titleAr || chapter.titleEn : chapter.titleEn || chapter.titleAr}
                  </p>
                  <ul className="mt-2 space-y-1 ps-4">
                    {chapter.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">
                          {isAr ? lesson.titleAr || lesson.titleEn : lesson.titleEn || lesson.titleAr}
                        </span>
                        {lesson.videoDuration ? (
                          <span>{formatDuration(lesson.videoDuration, locale)}</span>
                        ) : null}
                        {!lesson.isPublished && <Badge variant="outline">{t("draft")}</Badge>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Clock,
  Award,
  TrendingUp,
  PlayCircle,
  ChevronLeft,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("dashboard"),
  }
}

export default async function StudentDashboard() {
  const session = await auth()
  const t = await getTranslations("student")

  if (!session?.user?.id) return null

  // Fetch student data
  const [enrollments, certificates, recentProgress] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          include: {
            instructor: {
              select: { name: true, image: true },
            },
            chapters: {
              include: {
                lessons: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    db.certificate.count({
      where: { userId: session.user.id },
    }),
    db.progress.findMany({
      where: {
        userId: session.user.id,
        isCompleted: true,
      },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: {
                  select: { titleEn: true, titleAr: true, slug: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ])

  // Calculate progress for each course
  const coursesWithProgress = await Promise.all(
    enrollments.map(async (enrollment) => {
      const totalLessons = enrollment.course.chapters.reduce(
        (acc, ch) => acc + ch.lessons.length,
        0
      )

      const completedLessons = await db.progress.count({
        where: {
          userId: session.user!.id,
          isCompleted: true,
          lesson: {
            chapter: {
              courseId: enrollment.courseId,
            },
          },
        },
      })

      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0

      return {
        ...enrollment,
        totalLessons,
        completedLessons,
        progressPercentage,
      }
    })
  )

  // Calculate total stats
  const totalCourses = enrollments.length
  const inProgressCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage > 0 && c.progressPercentage < 100
  ).length
  const completedCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage === 100
  ).length
  const totalLearningHours = Math.floor(
    coursesWithProgress.reduce((acc, c) => acc + c.completedLessons * 10, 0) /
      60
  )

  // Continue learning courses
  const continueLearning = coursesWithProgress
    .filter((c) => c.progressPercentage > 0 && c.progressPercentage < 100)
    .slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("welcome")}, {session.user.name}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">{t("dashboardSubtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("enrolledCourses")}
            </CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCourses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("inProgress")}
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{inProgressCourses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("completed")}
            </CardTitle>
            <Award className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedCourses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("learningHours")}
            </CardTitle>
            <Clock className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalLearningHours}</p>
          </CardContent>
        </Card>
      </div>

      {/* Continue Learning */}
      {continueLearning.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t("continueLearning")}</h2>
            <Button variant="ghost" asChild>
              <Link href="/student/courses">
                {t("viewAll")}
                <ChevronLeft className="h-4 w-4 me-1" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueLearning.map((enrollment) => (
              <Card key={enrollment.id} className="overflow-hidden">
                <div className="relative aspect-video">
                  {enrollment.course.thumbnail ? (
                    <Image
                      src={enrollment.course.thumbnail}
                      alt={enrollment.course.titleEn || ""}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <PlayCircle className="h-10 w-10 text-primary/50" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold line-clamp-1 mb-2">
                    {enrollment.course.titleAr || enrollment.course.titleEn}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={enrollment.course.instructor.image || ""}
                      />
                      <AvatarFallback className="text-xs">
                        {enrollment.course.instructor.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{enrollment.course.instructor.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {enrollment.completedLessons}/{enrollment.totalLessons}{" "}
                        {t("lessons")}
                      </span>
                      <span className="font-medium">
                        {enrollment.progressPercentage}%
                      </span>
                    </div>
                    <Progress
                      value={enrollment.progressPercentage}
                      className="h-2"
                    />
                  </div>
                  <Button asChild className="w-full mt-4">
                    <Link href={`/courses/${enrollment.course.slug}/learn`}>
                      {t("continue")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProgress.map((progress) => (
                <div
                  key={progress.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                    <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {t("completedLesson")} "{progress.lesson.titleEn}"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {progress.lesson.chapter.course.titleEn}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(progress.updatedAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalCourses === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("noCourses")}</h3>
            <p className="text-muted-foreground mb-6">
              {t("noCoursesDescription")}
            </p>
            <Button asChild>
              <Link href="/courses">{t("browseCourses")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import Image from "next/image"
import { PlayCircle, Clock, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("myCourses"),
  }
}

export default async function StudentCoursesPage() {
  const session = await auth()
  const t = await getTranslations("student")
  const common = await getTranslations("common")

  if (!session?.user?.id) return null

  // Fetch enrollments
  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          instructor: {
            select: { name: true, image: true },
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
  })

  // Calculate progress for each course
  const coursesWithProgress = await Promise.all(
    enrollments.map(async (enrollment) => {
      const totalLessons = enrollment.course.chapters.reduce(
        (acc, ch) => acc + ch.lessons.length,
        0
      )

      const totalDuration = enrollment.course.chapters.reduce(
        (acc, ch) =>
          acc + ch.lessons.reduce((a, l) => a + (l.videoDuration || 0), 0),
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
        totalDuration,
        completedLessons,
        progressPercentage,
      }
    })
  )

  const inProgressCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage > 0 && c.progressPercentage < 100
  )
  const completedCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage === 100
  )
  const notStartedCourses = coursesWithProgress.filter(
    (c) => c.progressPercentage === 0
  )

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours} ${t("hours")} ${
        mins > 0 ? `${mins} ${t("minutes")}` : ""
      }`
    }
    return `${mins} ${t("minutes")}`
  }

  const CourseCard = ({
    enrollment,
  }: {
    enrollment: (typeof coursesWithProgress)[0]
  }) => (
    <Card className="overflow-hidden group hover:shadow-lg transition-all">
      <div className="relative aspect-video">
        {enrollment.course.thumbnail ? (
          <Image
            src={enrollment.course.thumbnail}
            alt={enrollment.course.titleEn}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <PlayCircle className="h-10 w-10 text-primary/50" />
          </div>
        )}
        {enrollment.progressPercentage === 100 && (
          <div className="absolute top-2 end-2">
            <Badge className="bg-green-500">{t("completed")}</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="text-xs text-primary font-medium mb-1">
            {enrollment.course.category?.nameAr ||
              enrollment.course.category?.nameEn}
          </p>
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {enrollment.course.titleAr || enrollment.course.titleEn}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {enrollment.course.instructor.name}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            <span>
              {enrollment.totalLessons} {t("lessons")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(enrollment.totalDuration)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {enrollment.completedLessons}/{enrollment.totalLessons}
            </span>
            <span className="font-medium">
              {enrollment.progressPercentage}%
            </span>
          </div>
          <Progress value={enrollment.progressPercentage} className="h-2" />
        </div>

        <Button asChild className="w-full">
          <Link href={`/courses/${enrollment.course.slug}/learn`}>
            {enrollment.progressPercentage === 0
              ? t("startCourse")
              : enrollment.progressPercentage === 100
              ? t("reviewCourse")
              : t("continue")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("myCourses")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("myCoursesDescription")}
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            {common("all")} ({coursesWithProgress.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            {t("inProgress")} ({inProgressCourses.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t("completed")} ({completedCourses.length})
          </TabsTrigger>
          <TabsTrigger value="not-started">
            {t("notStarted")} ({notStartedCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {coursesWithProgress.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coursesWithProgress.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="mt-6">
          {inProgressCourses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noInProgressCourses")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inProgressCourses.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedCourses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noCompletedCourses")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCourses.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="not-started" className="mt-6">
          {notStartedCourses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noNotStartedCourses")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notStartedCourses.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import {
  BookOpen,
  Users,
  DollarSign,
  Star,
  TrendingUp,
  Eye,
  Plus,
  ChevronLeft,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("dashboard"),
  }
}

export default async function InstructorDashboard() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) return null

  // Fetch instructor data
  const [
    courses,
    totalStudents,
    totalEarnings,
    pendingWithdrawal,
    recentReviews,
    recentEnrollments,
  ] = await Promise.all([
    db.course.findMany({
      where: { instructorId: session.user.id },
      include: {
        _count: {
          select: {
            enrollments: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.enrollment.count({
      where: {
        course: {
          instructorId: session.user.id,
        },
      },
    }),
    db.purchase.aggregate({
      where: {
        course: {
          instructorId: session.user.id,
        },
        status: "COMPLETED",
      },
      _sum: {
        instructorShare: true,
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    }),
    db.review.findMany({
      where: {
        course: {
          instructorId: session.user.id,
        },
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
        course: {
          select: { titleEn: true, titleAr: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.enrollment.findMany({
      where: {
        course: {
          instructorId: session.user.id,
        },
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
        course: {
          select: { titleEn: true, titleAr: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: 5,
    }),
  ])

  const publishedCourses = courses.filter(
    (c) => c.status === "PUBLISHED"
  ).length
  const draftCourses = courses.filter((c) => c.status === "DRAFT").length
  const pendingCourses = courses.filter((c) => c.status === "PENDING").length

  const averageRating =
    courses.length > 0
      ? courses.reduce((acc, c) => acc + c.averageRating, 0) / courses.length
      : 0

  const totalReviews = courses.reduce((acc, c) => acc + c._count.reviews, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t("welcome")}, {session.user.name}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">{t("dashboardSubtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/instructor/courses/create">
            <Plus className="h-4 w-4 ms-2" />
            {t("createCourse")}
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalCourses")}
            </CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{courses.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {publishedCourses} {t("published")} • {draftCourses} {t("draft")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalStudents")}
            </CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalStudents.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +12% {t("thisMonth")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEarnings")}
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {(totalEarnings._sum.instructorEarnings || 0).toLocaleString()}{" "}
              ج.م
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pendingBalance")}:{" "}
              {(pendingWithdrawal?.balance || 0).toLocaleString()} ج.م
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("averageRating")}
            </CardTitle>
            <Star className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{averageRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalReviews} {t("reviews")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("myCourses")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/instructor/courses">
                {t("viewAll")}
                <ChevronLeft className="h-4 w-4 me-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">{t("noCourses")}</p>
                <Button asChild>
                  <Link href="/instructor/courses/create">
                    {t("createFirst")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.slice(0, 5).map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {course.titleAr || course.titleEn}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {course._count.enrollments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {course.averageRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        course.status === "PUBLISHED"
                          ? "default"
                          : course.status === "PENDING"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {t(course.status.toLowerCase())}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("recentEnrollments")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/instructor/students">
                {t("viewAll")}
                <ChevronLeft className="h-4 w-4 me-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("noEnrollments")}
              </p>
            ) : (
              <div className="space-y-4">
                {recentEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {enrollment.user.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {enrollment.course.titleEn}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(enrollment.createdAt).toLocaleDateString(
                        "ar-EG"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("recentReviews")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/instructor/reviews">
              {t("viewAll")}
              <ChevronLeft className="h-4 w-4 me-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentReviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noReviews")}
            </p>
          ) : (
            <div className="space-y-4">
              {recentReviews.map((review) => (
                <div
                  key={review.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/30"
                >
                  <div className="flex-shrink-0">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{review.user.name}</p>
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                    <p className="text-sm text-primary mt-0.5">
                      {review.course.titleEn}
                    </p>
                    {review.comment && (
                      <p className="text-muted-foreground mt-2 line-clamp-2">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

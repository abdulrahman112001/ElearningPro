import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Eye,
  BookOpen,
  Star,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("analytics"),
  }
}

export default async function InstructorAnalyticsPage() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  // Get analytics data
  const [courses, enrollments, reviews, earnings] = await Promise.all([
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
    }),
    db.enrollment.findMany({
      where: {
        course: { instructorId: session.user.id },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    db.review.findMany({
      where: {
        course: { instructorId: session.user.id },
      },
    }),
    db.purchase.aggregate({
      where: {
        course: { instructorId: session.user.id },
        status: "COMPLETED",
      },
      _sum: { instructorShare: true },
    }),
  ])

  // Calculate stats
  const totalCourses = courses.length
  const publishedCourses = courses.filter(
    (c) => c.status === "PUBLISHED"
  ).length
  const totalStudents = enrollments.length
  const totalReviews = reviews.length
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
      : 0
  const totalEarnings = earnings._sum.instructorShare || 0

  // Monthly enrollments for the last 6 months
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const count = enrollments.filter((e) => {
      const date = new Date(e.enrolledAt)
      return date >= month && date <= monthEnd
    }).length
    monthlyData.push({
      month: month.toLocaleDateString("ar-EG", { month: "short" }),
      count,
    })
  }

  // Top courses
  const topCourses = [...courses]
    .sort((a, b) => b._count.enrollments - a._count.enrollments)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("analytics")}</h1>
        <p className="text-muted-foreground">
          {t("analyticsDescription") || "تحليلات وإحصائيات أداء كورساتك"}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalCourses")}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCourses}</div>
            <p className="text-xs text-muted-foreground">
              {publishedCourses} {t("published")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalStudents")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {monthlyData[5]?.count || 0} {t("thisMonth")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("averageRating")}
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {totalReviews} {t("reviews")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEarnings")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalEarnings.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Enrollments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("monthlyEnrollments") || "التسجيلات الشهرية"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {monthlyData.map((data, index) => {
                const maxCount = Math.max(...monthlyData.map((d) => d.count), 1)
                const height = (data.count / maxCount) * 100
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-1 flex-1"
                  >
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{
                        height: `${height}%`,
                        minHeight: data.count > 0 ? "8px" : "2px",
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {data.month}
                    </span>
                    <span className="text-xs font-medium">{data.count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Courses */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topCourses") || "أفضل الكورسات"}</CardTitle>
          </CardHeader>
          <CardContent>
            {topCourses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("noCourses")}
              </p>
            ) : (
              <div className="space-y-4">
                {topCourses.map((course, index) => (
                  <div key={course.id} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {course.titleAr || course.titleEn}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {course._count.enrollments} {t("students")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">
                        {course.averageRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course Performance */}
      <Card>
        <CardHeader>
          <CardTitle>{t("coursePerformance") || "أداء الكورسات"}</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noCourses")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-start py-3 px-2">
                      {t("course") || "الكورس"}
                    </th>
                    <th className="text-center py-3 px-2">{t("students")}</th>
                    <th className="text-center py-3 px-2">{t("reviews")}</th>
                    <th className="text-center py-3 px-2">
                      {t("rating") || "التقييم"}
                    </th>
                    <th className="text-center py-3 px-2">
                      {t("status") || "الحالة"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className="border-b">
                      <td className="py-3 px-2">
                        <p className="font-medium">
                          {course.titleAr || course.titleEn}
                        </p>
                      </td>
                      <td className="text-center py-3 px-2">
                        {course._count.enrollments}
                      </td>
                      <td className="text-center py-3 px-2">
                        {course._count.reviews}
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {course.averageRating.toFixed(1)}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            course.status === "PUBLISHED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}
                        >
                          {course.status === "PUBLISHED"
                            ? t("published")
                            : t("draft")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

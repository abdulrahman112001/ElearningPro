import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import {
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("dashboard"),
  }
}

export default async function AdminDashboard() {
  const t = await getTranslations("admin")

  // Fetch admin stats
  const [
    totalUsers,
    totalInstructors,
    totalStudents,
    totalCourses,
    publishedCourses,
    pendingCourses,
    totalRevenue,
    monthlyRevenue,
    pendingWithdrawals,
    recentUsers,
    recentCourses,
    pendingInstructors,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "PENDING_REVIEW" } }),
    db.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.purchase.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: {
          gte: new Date(new Date().setDate(1)), // First day of month
        },
      },
      _sum: { amount: true },
    }),
    db.withdrawal.count({ where: { status: "PENDING" } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    }),
    db.course.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        instructor: {
          select: { name: true },
        },
      },
    }),
    db.user.findMany({
      where: {
        role: "INSTRUCTOR",
        instructorProfile: {
          isApproved: false,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    }),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboardSubtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalUsers")}
            </CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalUsers.toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground">
                {totalInstructors} {t("instructors")} • {totalStudents}{" "}
                {t("students")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalCourses")}
            </CardTitle>
            <BookOpen className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCourses}</p>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground">
                {publishedCourses} {t("published")}
              </span>
              {pendingCourses > 0 && (
                <Badge variant="warning" className="text-xs">
                  {pendingCourses} {t("pending")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalRevenue")}
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {(totalRevenue._sum.amount || 0).toLocaleString()} ج.م
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
              <ArrowUp className="h-3 w-3" />
              <span>
                {(monthlyRevenue._sum.amount || 0).toLocaleString()}{" "}
                {t("thisMonth")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("pendingActions")}
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {pendingCourses + pendingWithdrawals + pendingInstructors.length}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>
                {pendingCourses} {t("courses")}
              </span>
              <span>•</span>
              <span>
                {pendingWithdrawals} {t("withdrawals")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("pendingCourses")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/courses?status=PENDING">
                {t("viewAll")}
                <ChevronLeft className="h-4 w-4 me-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentCourses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>{t("noPendingCourses")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {course.titleAr || course.titleEn}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {course.instructor.name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-green-600"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" asChild>
                        <Link href={`/admin/courses/${course.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Instructors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("pendingInstructors")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/instructors?approved=false">
                {t("viewAll")}
                <ChevronLeft className="h-4 w-4 me-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingInstructors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>{t("noPendingInstructors")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInstructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={instructor.image || ""} />
                        <AvatarFallback>
                          {instructor.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{instructor.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {instructor.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-green-600"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("recentUsers")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users">
              {t("viewAll")}
              <ChevronLeft className="h-4 w-4 me-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback>
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{user.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={user.role === "ADMIN" ? "default" : "secondary"}
                  >
                    {t(user.role.toLowerCase())}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

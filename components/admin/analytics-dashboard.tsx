"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { Users, BookOpen, DollarSign, TrendingUp, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface AnalyticsData {
  overview: {
    totalUsers: number
    newUsers: number
    totalCourses: number
    newCourses: number
    totalEnrollments: number
    newEnrollments: number
    totalRevenue: number
    periodRevenue: number
    pendingWithdrawals: number
    pendingWithdrawalsAmount: number
  }
  charts: {
    revenueByDay: Record<string, number>
    enrollmentsByDay: Record<string, number>
  }
  topCourses: any[]
  topInstructors: any[]
  recentActivities: {
    enrollments: any[]
    purchases: any[]
  }
}

export function AnalyticsDashboard() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const dateLocale = locale === "ar" ? ar : enUS

  const [period, setPeriod] = useState("30")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics?period=${period}`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Prepare chart data
  const revenueChartData = data.charts?.revenueByDay
    ? Object.entries(data.charts.revenueByDay).map(([date, amount]) => ({
        date: format(new Date(date), "MMM dd", { locale: dateLocale }),
        amount,
      }))
    : []

  const enrollmentChartData = data.charts?.enrollmentsByDay
    ? Object.entries(data.charts.enrollmentsByDay).map(([date, count]) => ({
        date: format(new Date(date), "MMM dd", { locale: dateLocale }),
        count,
      }))
    : []

  return (
    <div className="space-y-8">
      {/* Period Selector */}
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("last7Days")}</SelectItem>
            <SelectItem value="30">{t("last30Days")}</SelectItem>
            <SelectItem value="90">{t("last90Days")}</SelectItem>
            <SelectItem value="365">{t("lastYear")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalUsers")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalUsers}</div>
            <p className="text-xs text-green-600">
              +{data.overview.newUsers} {t("inPeriod")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("publishedCourses")}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.totalCourses}
            </div>
            <p className="text-xs text-green-600">
              +{data.overview.newCourses} {t("inPeriod")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("enrollments")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.totalEnrollments}
            </div>
            <p className="text-xs text-green-600">
              +{data.overview.newEnrollments} {t("inPeriod")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("revenue")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.overview.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-green-600">
              +${data.overview.periodRevenue.toFixed(2)} {t("inPeriod")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("revenueOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t("noDataAvailable")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("enrollmentsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {enrollmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t("noDataAvailable")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Lists */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Top Courses */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topCourses")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topCourses.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {t("noCourses")}
              </p>
            ) : (
              <div className="space-y-4">
                {data.topCourses.map((course, index) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-medium">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium line-clamp-1">
                          {course.titleEn}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("by")} {course.instructor.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-medium">{course.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("students")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Instructors */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topInstructors")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topInstructors.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {t("noInstructors")}
              </p>
            ) : (
              <div className="space-y-4">
                {data.topInstructors.map((instructor, index) => (
                  <div
                    key={instructor.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-medium">
                        #{index + 1}
                      </span>
                      <Avatar>
                        <AvatarImage src={instructor.image || undefined} />
                        <AvatarFallback>
                          {instructor.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{instructor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {instructor.coursesCount} {t("courses")}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-medium">{instructor.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("students")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              ...data.recentActivities.purchases,
              ...data.recentActivities.enrollments,
            ]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
              .slice(0, 10)
              .map((activity: any) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {activity.amount
                        ? `${activity.user.name} ${t("purchasedCourse")}`
                        : `${activity.user.name} ${t("enrolledIn")}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.course.titleEn}
                    </p>
                  </div>
                  <div className="text-end">
                    {activity.amount && (
                      <Badge variant="secondary">
                        ${activity.amount.toFixed(2)}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(
                        new Date(activity.enrolledAt || activity.createdAt),
                        "PPp",
                        {
                          locale: dateLocale,
                        }
                      )}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

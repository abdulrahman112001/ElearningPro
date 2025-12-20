import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Users, Search, BookOpen, Calendar, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("students"),
  }
}

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: { search?: string; course?: string }
}) {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  // Get instructor's courses
  const instructorCourses = await db.course.findMany({
    where: { instructorId: session.user.id },
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      slug: true,
    },
  })

  const courseIds = instructorCourses.map((c) => c.id)

  // Build where clause for search
  const whereClause: any = {
    courseId: { in: courseIds },
  }

  if (searchParams.course) {
    whereClause.courseId = searchParams.course
  }

  if (searchParams.search) {
    whereClause.user = {
      OR: [
        { name: { contains: searchParams.search, mode: "insensitive" } },
        { email: { contains: searchParams.search, mode: "insensitive" } },
      ],
    }
  }

  // Get enrolled students
  const enrollments = await db.enrollment.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      course: {
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          slug: true,
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  })

  // Get unique students with their enrollment count
  const studentsMap = new Map<
    string,
    {
      user: {
        id: string
        name: string | null
        email: string | null
        image: string | null
      }
      enrolledCourses: Array<{
        id: string
        titleEn: string
        titleAr: string
        slug: string
      }>
      lastEnrolled: Date
      progress: number
    }
  >()

  for (const enrollment of enrollments) {
    const existing = studentsMap.get(enrollment.userId)
    if (existing) {
      existing.enrolledCourses.push(enrollment.course)
      if (enrollment.createdAt > existing.lastEnrolled) {
        existing.lastEnrolled = enrollment.createdAt
      }
    } else {
      studentsMap.set(enrollment.userId, {
        user: enrollment.user,
        enrolledCourses: [enrollment.course],
        lastEnrolled: enrollment.createdAt,
        progress: enrollment.progress || 0,
      })
    }
  }

  const students = Array.from(studentsMap.values())

  // Stats
  const totalStudents = students.length
  const totalEnrollments = enrollments.length
  const thisMonthEnrollments = enrollments.filter((e) => {
    const now = new Date()
    const enrollDate = new Date(e.createdAt)
    return (
      enrollDate.getMonth() === now.getMonth() &&
      enrollDate.getFullYear() === now.getFullYear()
    )
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("students")}</h1>
          <p className="text-muted-foreground">
            {t("studentsDescription") || "إدارة ومتابعة طلابك"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalStudents")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEnrollments") || "إجمالي التسجيلات"}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrollments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("thisMonth")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonthEnrollments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="search"
                placeholder={t("searchStudents") || "ابحث عن طالب..."}
                defaultValue={searchParams.search}
                className="ps-10"
              />
            </div>
            <select
              name="course"
              defaultValue={searchParams.course || ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("allCourses") || "جميع الكورسات"}</option>
              {instructorCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.titleAr || course.titleEn}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {t("search") || "بحث"}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="pt-6">
          {students.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t("noStudents") || "لا يوجد طلاب"}
              </h3>
              <p className="text-muted-foreground">
                {t("noStudentsDescription") || "لم يسجل أي طالب في كورساتك بعد"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("student") || "الطالب"}</TableHead>
                  <TableHead>{t("email") || "البريد الإلكتروني"}</TableHead>
                  <TableHead>
                    {t("enrolledCourses") || "الكورسات المسجلة"}
                  </TableHead>
                  <TableHead>{t("enrolledAt") || "تاريخ التسجيل"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.user.image || undefined} />
                          <AvatarFallback>
                            {student.user.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {student.user.name || t("anonymous") || "مجهول"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${student.user.email}`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {student.user.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.enrolledCourses.slice(0, 2).map((course) => (
                          <Badge
                            key={course.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {course.titleAr || course.titleEn}
                          </Badge>
                        ))}
                        {student.enrolledCourses.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{student.enrolledCourses.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(student.lastEnrolled).toLocaleDateString(
                        "ar-EG",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getLocale, getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { BookOpen, Calendar, Mail, Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AvatarName, EmptyState, PageHeader, SectionCard, StatCard } from "@/components/shared"
import { SendAlertDialog } from "@/components/instructor/send-alert-dialog"

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
  const tAlerts = await getTranslations("alerts")
  const locale = await getLocale()
  const pickTitle = (c: { titleAr: string | null; titleEn: string | null }) =>
    locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")

  if (!session?.user?.id) {
    redirect("/login")
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

  if (searchParams.course && courseIds.includes(searchParams.course)) {
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
          guardianEmail: true,
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
        guardianEmail: string | null
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
      if (enrollment.enrolledAt > existing.lastEnrolled) {
        existing.lastEnrolled = enrollment.enrolledAt
      }
    } else {
      studentsMap.set(enrollment.userId, {
        user: enrollment.user,
        enrolledCourses: [enrollment.course],
        lastEnrolled: enrollment.enrolledAt,
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
    const enrollDate = new Date(e.enrolledAt)
    return (
      enrollDate.getMonth() === now.getMonth() &&
      enrollDate.getFullYear() === now.getFullYear()
    )
  }).length

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const filtered = Boolean(searchParams.search || searchParams.course)

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title={t("students")} description={t("studentsDescription")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label={t("totalStudents")} value={nf.format(totalStudents)} icon={Users} />
        <StatCard label={t("totalEnrollments")} value={nf.format(totalEnrollments)} icon={BookOpen} tone="info" />
        <StatCard
          label={t("thisMonth")}
          value={nf.format(thisMonthEnrollments)}
          icon={Calendar}
          tone="success"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <SectionCard contentClassName="p-0">
        <form className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:px-6">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="search"
              placeholder={t("searchStudents")}
              defaultValue={searchParams.search}
              className="ps-10"
              aria-label={t("searchStudents")}
            />
          </div>
          <select
            name="course"
            defaultValue={searchParams.course || ""}
            aria-label={t("allCourses")}
            className="h-10 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
          >
            <option value="">{t("allCourses")}</option>
            {instructorCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {pickTitle(course)}
              </option>
            ))}
          </select>
          <Button type="submit" className="gap-2">
            <Search className="h-4 w-4" />
            {t("search")}
          </Button>
        </form>

        {students.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={Users}
            title={t("noStudents")}
            description={filtered ? undefined : t("noStudentsDescription")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="ps-4 sm:ps-6">{t("student")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("enrolledCourses")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("enrolledAt")}</TableHead>
                <TableHead className="pe-4 text-end sm:pe-6">
                  <span className="sr-only">{tAlerts("sendAlert")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.user.id}>
                  <TableCell className="ps-4 sm:ps-6">
                    <AvatarName
                      name={student.user.name || t("anonymous")}
                      image={student.user.image}
                      className="max-w-[13rem] sm:max-w-xs"
                      secondary={
                        student.user.email ? (
                          <a
                            href={`mailto:${student.user.email}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            {student.user.email}
                          </a>
                        ) : null
                      }
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {student.enrolledCourses.slice(0, 2).map((course) => (
                        <Badge key={course.id} variant="secondary" className="max-w-[12rem] truncate text-xs font-medium">
                          {pickTitle(course)}
                        </Badge>
                      ))}
                      {student.enrolledCourses.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{student.enrolledCourses.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                    {dateFmt.format(new Date(student.lastEnrolled))}
                  </TableCell>
                  <TableCell className="pe-4 text-end sm:pe-6">
                    <div className="hidden lg:block">
                      <SendAlertDialog
                        student={{
                          id: student.user.id,
                          name: student.user.name,
                          hasGuardianEmail: !!student.user.guardianEmail,
                        }}
                      />
                    </div>
                    <div className="lg:hidden">
                      <SendAlertDialog
                        iconOnly
                        student={{
                          id: student.user.id,
                          name: student.user.name,
                          hasGuardianEmail: !!student.user.guardianEmail,
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
